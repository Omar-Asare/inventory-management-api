const db = require("../config/database");
const AppError = require("../utils/appError");

exports.adjustStock = (req, res, next) => {
  const { product_id, change_amount, reason } = req.body;

  if (!product_id || change_amount === undefined || !reason) {
    return next(
      new AppError(
        "Product ID, change amount, and a clear reason are required fields.",
        400,
      ),
    );
  }

  const transaction = db.transaction(() => {
    const product = db
      .prepare("SELECT quantity FROM products WHERE id = ?")
      .get(product_id);
    if (!product) {
      throw new AppError(
        "Target product record not found for stock adjustment.",
        404,
      );
    }

    const calculatedNewQuantity = product.quantity + change_amount;
    const movementType = change_amount >= 0 ? "in" : "out";

    if (calculatedNewQuantity < 0) {
      throw new AppError(
        `Invalid adjustment. Warehouse only has ${product.quantity} items in stock, cannot deduct ${Math.abs(change_amount)}.`,
        400,
      );
    }

    db.prepare("UPDATE products SET quantity = ? WHERE id = ?").run(
      calculatedNewQuantity,
      product_id,
    );

    const ledgerStmt = db.prepare(`
      INSERT INTO stock_movements (product_id, change_amount, type, reason, performed_by)
      VALUES (?, ?, ?, ?, ?)
    `);

    ledgerStmt.run(
      product_id,
      Math.abs(change_amount),
      movementType,
      reason,
      req.user.id,
    );

    return calculatedNewQuantity;
  });

  try {
    const updatedQuantity = transaction();
    res.status(200).json({
      message: "Stock adjusted and logged successfully!",
      new_quantity: updatedQuantity,
    });
  } catch (error) {
    next(error);
  }
};
