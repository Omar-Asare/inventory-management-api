const express = require("express");
const categoryRoutes = require("./src/routes/categoryRoutes");
const app = express();

// Middleware to read JSON [cite: 13]
app.use(express.json());

// Apply routes - All category requests are sent to categoryRoutes
app.use("/api/v1/categories", categoryRoutes);

// The "Hello" route is optional now, but you can keep a simple version for testing
app.get("/", (req, res) => {
  res.send("Inventory API is running!");
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
