const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { protect, authorize } = require("../middleware/auth");

router.post("/", protect, authorize("admin"), productController.createProduct);

module.exports = router;
