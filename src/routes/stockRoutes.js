const express = require("express");
const router = express.Router();
const stockController = require("../controllers/stockController");
const { protect, authorize } = require("../middleware/auth");

router.get(
  "/analytics/summary",
  protect,
  authorize("admin"),
  stockController.getInventorySummary,
);
router.post("/adjust", protect, stockController.adjustStock);

module.exports = router;
