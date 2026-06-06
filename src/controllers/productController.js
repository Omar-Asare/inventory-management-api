const db = require("../config/database");
const AppError = require("../utils/appError"); // 1. Import our custom error utility

exports.createProduct = (req, res, next) => {
  const {
    name,
    sku,
    description,
    price,
    quantity,
    low_stock_threshold,
    category_id,
  } = req.body;

  if (!name || !sku || price === undefined || quantity === undefined) {
    return next(
      new AppError("Name, SKU, Price, and Quantity are required fields.", 400),
    );
  }

  const transaction = db.transaction(() => {
    const productStmt = db.prepare(`
      INSERT INTO products (name, sku, description, price, quantity, low_stock_threshold, category_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const info = productStmt.run(
      name,
      sku,
      description,
      price,
      quantity,
      low_stock_threshold || 10,
      category_id,
    );
    const productId = info.lastInsertRowid;

    const ledgerStmt = db.prepare(`
      INSERT INTO stock_movements (product_id, quantity, type, reason)
      VALUES (?, ?, 'in', 'Initial stock allocation on product creation')
    `);
    ledgerStmt.run(productId, quantity);

    return productId;
  });

  try {
    const newProductId = transaction();
    res.status(201).json({
      message: "Product created and initialized in ledger!",
      id: newProductId,
    });
  } catch (error) {
    next(error);
  }
};

exports.getProducts = (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { search, category_id } = req.query;

    let queryStr = `
      SELECT p.*, c.name AS category_name 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
    `;
    let countStr = `SELECT COUNT(*) as total FROM products p`;

    const whereConditions = ["p.is_deleted = 0"];
    const queryParams = [];

    if (search) {
      whereConditions.push(`(p.name LIKE ? OR p.sku LIKE ?)`);
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    if (category_id) {
      whereConditions.push(`p.category_id = ?`);
      queryParams.push(category_id);
    }

    const whereClause = ` WHERE ` + whereConditions.join(" AND ");
    queryStr += whereClause;
    countStr += whereClause;

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

exports.getProductById = (req, res, next) => {
  try {
    const product = db
      .prepare(
        `
      SELECT p.*, c.name AS category_name 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ? AND p.is_deleted = 0
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

exports.updateProduct = (req, res, next) => {
  const { id } = req.params;
  const { name, description, price, low_stock_threshold, category_id } =
    req.body;

  try {
    const product = db
      .prepare("SELECT * FROM products WHERE id = ? AND is_deleted = 0")
      .get(id);
    if (!product) {
      return next(new AppError("Product record not found.", 404));
    }

    const stmt = db.prepare(`
      UPDATE products 
      SET name = ?, description = ?, price = ?, low_stock_threshold = ?, category_id = ? 
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
      id,
    );

    res.status(200).json({ message: "Product updated successfully!" });
  } catch (error) {
    next(error);
  }
};

exports.deleteProduct = (req, res, next) => {
  const { id } = req.params;

  try {
    const product = db
      .prepare("SELECT * FROM products WHERE id = ? AND is_deleted = 0")
      .get(id);
    if (!product) {
      return next(
        new AppError(
          "Product record not found or has already been safely archived.",
          404,
        ),
      );
    }

    db.prepare("UPDATE products SET is_deleted = 1 WHERE id = ?").run(id);

    res.status(200).json({
      status: "success",
      message: `Product '${product.name}' has been safely archived and removed from active inventory calculations.`,
    });
  } catch (error) {
    next(error);
  }
};

exports.getLowStockAlerts = (req, res, next) => {
  try {
    const lowStockItems = db
      .prepare(
        `
      SELECT p.id, p.name, p.sku, p.quantity, p.low_stock_threshold, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.quantity <= p.low_stock_threshold AND p.is_deleted = 0
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
      SELECT p.id, p.name, p.sku, p.quantity, p.low_stock_threshold, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.quantity <= p.low_stock_threshold AND p.is_deleted = 0
    `,
      )
      .all();

    const csvHeaders = [
      "Product ID",
      "Name",
      "SKU",
      "Current Stock",
      "Threshold Limit",
      "Category",
    ];

    const csvRows = lowStockItems.map((item) => [
      item.id,
      `"${item.name.replace(/"/g, '""')}"`,
      item.sku,
      item.quantity,
      item.low_stock_threshold,
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
