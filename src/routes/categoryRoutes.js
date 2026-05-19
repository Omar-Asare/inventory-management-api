const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");
const { protect, authorize } = require("../middleware/auth");

router.post(
  "/",
  protect,
  authorize("admin"),
  categoryController.createCategory,
);

module.exports = router;
