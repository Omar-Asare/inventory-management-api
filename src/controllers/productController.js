const db = require("../config/database");

exports.createProduct = (req, res) => {
  const {
    sku,
    name,
    description,
    category_id,
    price,
    quantity,
    low_stock_threshold,
  } = req.body;

  const transaction = db.transaction(() => {
    const productstmt = db.prepare(`
      INSERT INTO products (sku, name, description, category_id, price, quantity, low_stock_threshold)
            VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

    const result = productstmt.run(
      sku,
      name,
      description,
      category_id,
      price,
      quantity,
      low_stock_threshold,
    );

    const productId = result.lastInsertRowid;

    const movementstmt = db.prepare(` 
        INSERT INTO stock_movements (product_id, type, quantity, reason)
        VALUES (?, 'in', ?, 'Initial stock on creation')
        `);
    movementstmt.run(productId, quantity);

    return productId;
  });

  try {
    const id = transaction();
    res
      .status(201)
      .json({ message: "Product created and stock recorded!", id });
  } catch (error) {
    if (error.message.includes("UNIQUE constraint failed")) {
      return res.status(409).json({ error: "SKU already exists" });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.getProducts = (req, res) => {
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

    if (whereConditions.length > 0) {
      const whereClause = ` WHERE ` + whereConditions.join(" AND ");
      queryStr += whereClause;
      countStr += whereClause;
    }

    const totalRecords = db.prepare(countStr).get(...queryParams).total;

    queryStr += ` ORDER BY p.id DESC LIMIT ? OFFSET ?`;

    const dataParams = [...queryParams, limit, offset];
    const products = db.prepare(queryStr).all(...dataParams);

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
    res.status(500).json({ error: error.message });
  }
};

exports.getProductById = (req, res) => {
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
      return res.status(404).json({ error: "Product not found" });
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateProduct = (req, res) => {
  const { name, description, price, low_stock_threshold } = req.body;
  const { id } = req.params;

  try {
    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const stmt = db.prepare(`
      UPDATE products 
      SET name = ?, description = ?, price = ?, low_stock_threshold = ?
      WHERE id = ?
    `);

    stmt.run(
      name || product.name,
      description !== undefined ? description : product.description,
      price || product.price,
      low_stock_threshold || product.low_stock_threshold,
      id,
    );

    res.status(200).json({ message: "Product updated successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteProduct = (req, res) => {
  const { id } = req.params;

  try {
    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const deleteTransaction = db.transaction(() => {
      db.prepare("DELETE FROM stock_movements WHERE product_id = ?").run(id);
      db.prepare("DELETE FROM products WHERE id = ?").run(id);
    });

    deleteTransaction();
    res.status(200).json({
      message: "Product and associated movement logs deleted safely.",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getLowStockAlerts = (req, res) => {
  try {
    const lowStockProducts = db
      .prepare(
        `
      SELECT p.*, c.name AS category_name 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.quantity <= p.low_stock_threshold
    `,
      )
      .all();

    res.status(200).json({
      count: lowStockProducts.length,
      alerts: lowStockProducts,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
