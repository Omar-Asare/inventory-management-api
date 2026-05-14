const express = require("express");
const categoryRoutes = require("./src/routes/categoryRoutes");
const productRoutes = require("./src/routes/productRoutes");
const app = express();

app.use(express.json());

app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/products", productRoutes);

app.get("/", (req, res) => {
  res.send("Inventory API is running!");
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
