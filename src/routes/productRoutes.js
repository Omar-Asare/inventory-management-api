const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { protect, authorize } = require("../middleware/auth");

router.post("/", protect, authorize("admin"), productController.createProduct);

router.get("/", protect, productController.getProducts);

router.get("/:id", protect, productController.getProductById);

router.patch(
  "/:id",
  protect,
  authorize("admin"),
  productController.updateProduct,
);

router.delete(
  "/:id",
  protect,
  authorize("admin"),
  productController.deleteProduct,
);

module.exports = router;
