const db = require("../config/database");
const AppError = require("../utils/appError");
const { sendLowStockAlert } = require("../services/notificationService");

// POST /api/v1/stock/adjust
exports.adjustStock = (req, res, next) => {
  // Added explicit 'type' extraction alongside quantity, product_id, and reason
  const { product_id, quantity, type, reason } = req.body;

  if (!product_id || quantity === undefined || !type || !reason) {
    return next(
      new AppError(
        "Product ID, quantity, type ('in'|'out'|'adjustment'), and a clear reason are required fields.",
        400,
      ),
    );
  }

  // Enforce valid enum parameters matching database constraints
  if (!["in", "out", "adjustment"].includes(type)) {
    return next(
      new AppError(
        "Invalid movement type. Must be 'in', 'out', or 'adjustment'.",
        400,
      ),
    );
  }

  // Enforce that quantity values are not negative numbers
  if (quantity < 0) {
    return next(
      new AppError("Quantity value must be a positive integer.", 400),
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

    let calculatedNewQuantity;

    // Evaluate business rules based on the explicitly declared movement type
    if (type === "adjustment") {
      // Rule: 'adjustment' sets the value directly to the provided value
      calculatedNewQuantity = quantity;
    } else if (type === "in") {
      calculatedNewQuantity = product.quantity + quantity;
    } else if (type === "out") {
      calculatedNewQuantity = product.quantity - quantity;
    }

    // Safety check to avoid illegal negative warehouse entries
    if (calculatedNewQuantity < 0) {
      throw new AppError(
        `Invalid operational volume. Warehouse only has ${product.quantity} items in stock, cannot deduct ${quantity}.`,
        400,
      );
    }

    // Update the master tracking record table
    db.prepare("UPDATE products SET quantity = ? WHERE id = ?").run(
      calculatedNewQuantity,
      product_id,
    );

    // Aligned with updated schema: tracking req.user.id
    const ledgerStmt = db.prepare(`
      INSERT INTO stock_movements (product_id, user_id, quantity, type, reason)
      VALUES (?, ?, ?, ?, ?)
    `);

    ledgerStmt.run(product_id, req.user.id, quantity, type, reason);

    return calculatedNewQuantity;
  });

  try {
    const updatedQuantity = transaction();

    res.status(200).json({
      status: "success",
      message: "Stock movement recorded and logged cleanly in ledger history!",
      new_quantity: updatedQuantity,
    });

    // Check low stock triggers after running the database transaction
    const product = db
      .prepare(
        "SELECT name, sku, quantity, low_stock_threshold FROM products WHERE id = ?",
      )
      .get(product_id);

    if (product && product.quantity <= product.low_stock_threshold) {
      sendLowStockAlert(
        product.name,
        product.sku,
        product.quantity,
        product.low_stock_threshold,
      );
    }
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/stock/analytics/summary
exports.getInventorySummary = (req, res, next) => {
  try {
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

    // Grouping includes 'adjustment' types now
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
    const adjustments = ledgerTrends.find((t) => t.type === "adjustment") || {
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
          adjustments: {
            total_transactions: adjustments.transaction_count,
            units_recalibrated: adjustments.total_units_moved || 0,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
