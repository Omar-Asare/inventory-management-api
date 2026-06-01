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
    const products = db
      .prepare(
        `
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
    `,
      )
      .all();
    res.status(200).json(products);
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
