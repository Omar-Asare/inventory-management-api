const db = require("../config/database");

exports.adjustStock = (req, res) => {
  const { product_id, quantity, reason } = req.body;

  if (!product_id || quantity === undefined || !reason) {
    return res
      .status(400)
      .json({
        error: "Product ID, quantity variation, and reason are required.",
      });
  }

  if (quantity === 0) {
    return res
      .status(400)
      .json({ error: "Adjustment quantity cannot be zero." });
  }

  const type = quantity > 0 ? "in" : "out";
  // We want to store the positive absolute number in the movement log history
  const absoluteQuantity = Math.abs(quantity);

  const adjustmentTransaction = db.transaction(() => {
    // Check if the target product exists
    const product = db
      .prepare("SELECT quantity FROM products WHERE id = ?")
      .get(product_id);
    if (!product) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    const newQuantity = product.quantity + quantity;

    // Safety guardrail: Prevent warehouse counts from dropping below zero
    if (newQuantity < 0) {
      throw new Error("INSUFFICIENT_STOCK");
    }

    const updateProductStmt = db.prepare(`
      UPDATE products 
      SET quantity = ? 
      WHERE id = ?
    `);
    updateProductStmt.run(newQuantity, product_id);

    const logMovementStmt = db.prepare(`
      INSERT INTO stock_movements (product_id, type, quantity, reason)
      VALUES (?, ?, ?, ?)
    `);
    logMovementStmt.run(product_id, type, absoluteQuantity, reason);

    return newQuantity;
  });

  try {
    const updatedCount = adjustmentTransaction();
    res.status(200).json({
      message: "Stock adjusted and logged successfully!",
      product_id,
      new_total_quantity: updatedCount,
    });
  } catch (error) {
    if (error.message === "PRODUCT_NOT_FOUND") {
      return res
        .status(404)
        .json({ error: "Target product record not found." });
    }
    if (error.message === "INSUFFICIENT_STOCK") {
      return res
        .status(400)
        .json({
          error:
            "Operation rejected: Adjustment would cause stock level to drop below 0.",
        });
    }
    res.status(500).json({ error: error.message });
  }
};
