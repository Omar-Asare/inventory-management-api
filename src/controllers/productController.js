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
