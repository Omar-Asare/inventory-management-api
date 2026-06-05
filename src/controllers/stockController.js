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

exports.getInventorySummary = (req, res, next) => {
  try {
    // 1. Calculate overall warehouse metrics
    const generalMetrics = db
      .prepare(
        `
      SELECT 
        COUNT(*) as total_unique_products,
        SUM(quantity) as total_stock_units,
        SUM(price * quantity) as total_warehouse_value
      FROM products
    `,
      )
      .get();

    const ledgerTrends = db
      .prepare(
        `
      SELECT 
        type,
        COUNT(*) as transaction_count,
        SUM(quantity) as total_units_moved
      FROM stock_movements
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY type
    `,
      )
      .all();

    const inflows = ledgerTrends.find((t) => t.type === "in") || {
      transaction_count: 0,
      total_units_moved: 0,
    };
    const outflows = ledgerTrends.find((t) => t.type === "out") || {
      transaction_count: 0,
      total_units_moved: 0,
    };

    res.status(200).json({
      status: "success",
      data: {
        warehouse: {
          total_unique_products: generalMetrics.total_unique_products || 0,
          total_stock_units: generalMetrics.total_stock_units || 0,
          total_warehouse_value: generalMetrics.total_warehouse_value || 0,
        },
        recent_activity_30_days: {
          inflows: {
            total_transactions: inflows.transaction_count,
            units_received: inflows.total_units_moved || 0,
          },
          outflows: {
            total_transactions: outflows.transaction_count,
            units_deducted: outflows.total_units_moved || 0,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
