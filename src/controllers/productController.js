const db = require("../config/database");
const AppError = require("../utils/appError");

// POST /api/v1/products
exports.createProduct = (req, res, next) => {
  const {
    name,
    sku,
    description,
    price,
    quantity,
    low_stock_threshold,
    category_id,
    unit, // Added per project specification data model
  } = req.body;

  if (!name || !sku || price === undefined || quantity === undefined) {
    return next(
      new AppError("Name, SKU, Price, and Quantity are required fields.", 400),
    );
  }

  const transaction = db.transaction(() => {
    // Check for duplicate SKU to enforce 409 Conflict requirement
    const duplicateSKU = db
      .prepare("SELECT id FROM products WHERE sku = ?")
      .get(sku);
    if (duplicateSKU) {
      throw new AppError(`A product with SKU '${sku}' already exists.`, 409);
    }

    const productStmt = db.prepare(`
      INSERT INTO products (name, sku, description, price, quantity, low_stock_threshold, category_id, unit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = productStmt.run(
      name,
      sku,
      description,
      price,
      quantity,
      low_stock_threshold || 5,
      category_id,
      unit || "pcs",
    );
    const productId = info.lastInsertRowid;

    // Fixed: Aligned with updated schema using user_id auditing columns
    const ledgerStmt = db.prepare(`
      INSERT INTO stock_movements (product_id, user_id, quantity, type, reason)
      VALUES (?, ?, ?, 'in', 'Initial stock allocation on product creation')
    `);
    ledgerStmt.run(productId, req.user.id, quantity);

    return productId;
  });

  try {
    const newProductId = transaction();
    res.status(201).json({
      status: "success",
      message: "Product created and initialized in ledger!",
      id: newProductId,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/products
exports.getProducts = (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { search, category_id, low_stock } = req.query;

    let queryStr = `
      SELECT p.*, c.name AS category_name 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
    `;
    let countStr = `SELECT COUNT(*) as total FROM products p`;

    const whereConditions = [];
    const queryParams = [];

    if (search) {
      whereConditions.push(`(p.name LIKE ? OR p.sku LIKE ?)`);
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    if (category_id) {
      whereConditions.push(`p.category_id = ?`);
      queryParams.push(category_id);
    }

    // Fixed: Supports dynamic evaluation filtering for low stock at query time
    if (low_stock === "true") {
      whereConditions.push(`p.quantity <= p.low_stock_threshold`);
    }

    if (whereConditions.length > 0) {
      const whereClause = ` WHERE ` + whereConditions.join(" AND ");
      queryStr += whereClause;
      countStr += whereClause;
    }

    const totalRecords = db.prepare(countStr).get(...queryParams).total;

    queryStr += ` ORDER BY p.id DESC LIMIT ? OFFSET ?`;
    const products = db.prepare(queryStr).all(...queryParams, limit, offset);

    res.status(200).json({
      meta: {
        total_items: totalRecords,
        current_page: page,
        per_page: limit,
        total_pages: Math.ceil(totalRecords / limit),
      },
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/products/:id
exports.getProductById = (req, res, next) => {
  try {
    const product = db
      .prepare(
        `
      SELECT p.*, c.name AS category_name 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `,
      )
      .get(req.params.id);

    if (!product) {
      return next(new AppError("Product record not found.", 404));
    }

    res.status(200).json(product);
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/products/:id
exports.updateProduct = (req, res, next) => {
  const { id } = req.params;
  const { name, description, price, low_stock_threshold, category_id, unit } =
    req.body;

  try {
    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
    if (!product) {
      return next(new AppError("Product record not found.", 404));
    }

    const stmt = db.prepare(`
      UPDATE products 
      SET name = ?, description = ?, price = ?, low_stock_threshold = ?, category_id = ?, unit = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      name || product.name,
      description !== undefined ? description : product.description,
      price !== undefined ? price : product.price,
      low_stock_threshold !== undefined
        ? low_stock_threshold
        : product.low_stock_threshold,
      category_id !== undefined ? category_id : product.category_id,
      unit || product.unit,
      id,
    );

    res
      .status(200)
      .json({ status: "success", message: "Product updated successfully!" });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/products/:id (Admin Only Guarded at Route Level)
exports.deleteProduct = (req, res, next) => {
  const { id } = req.params;

  try {
    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
    if (!product) {
      return next(new AppError("Product record not found.", 404));
    }

    // Fixed: Complete transaction-backed cascade hard delete per spec
    const deleteTransaction = db.transaction(() => {
      db.prepare("DELETE FROM stock_movements WHERE product_id = ?").run(id);
      db.prepare("DELETE FROM products WHERE id = ?").run(id);
    });

    deleteTransaction();

    res.status(200).json({
      status: "success",
      message: `Product '${product.name}' and its associated movement log history have been permanently deleted.`,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/reports/inventory (Can be utilized here or routed within report controllers)
exports.getLowStockAlerts = (req, res, next) => {
  try {
    const lowStockItems = db
      .prepare(
        `
      SELECT p.id, p.name, p.sku, p.quantity, p.low_stock_threshold, p.unit, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.quantity <= p.low_stock_threshold
    `,
      )
      .all();

    res.status(200).json({
      count: lowStockItems.length,
      alerts: lowStockItems,
    });
  } catch (error) {
    next(error);
  }
};

exports.exportLowStockCSV = (req, res, next) => {
  try {
    const lowStockItems = db
      .prepare(
        `
      SELECT p.id, p.name, p.sku, p.quantity, p.low_stock_threshold, p.unit, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.quantity <= p.low_stock_threshold
    `,
      )
      .all();

    const csvHeaders = [
      "Product ID",
      "Name",
      "SKU",
      "Current Stock",
      "Threshold Limit",
      "Unit",
      "Category",
    ];

    const csvRows = lowStockItems.map((item) => [
      item.id,
      `"${item.name.replace(/"/g, '""')}"`,
      item.sku,
      item.quantity,
      item.low_stock_threshold,
      item.unit,
      item.category_name || "Uncategorized",
    ]);

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row) => row.join(",")),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=low_stock_report.csv",
    );

    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};
