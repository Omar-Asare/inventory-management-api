const express = require("express");
const router = express.Router();
const stockController = require("../controllers/stockController");
const { protect } = require("../middleware/auth");

router.post("/adjust", protect, stockController.adjustStock);

module.exports = router;
