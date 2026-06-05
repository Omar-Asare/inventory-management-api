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
router.get("/", protect, categoryController.getCategories);
router.get("/:id", protect, categoryController.getCategoryById);
router.patch(
  "/:id",
  protect,
  authorize("admin"),
  categoryController.updateCategory,
); // Typo Fixed Here!
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  categoryController.deleteCategory,
);

module.exports = router;
