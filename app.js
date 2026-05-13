const express = require("express");
const db = require("./src/config/database");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("The Inventory API is waking up !");
});

app.post("/api/v1/categories", (req, res) => {
  const { name, description } = req.body;

  try {
    const info = db
      .prepare("INSERT INTO categories (name, description) VALUES (?, ?)")
      .run(name, description);
    res.status(201).json({
      message: "categories created!",
      id: info.lastInsertRowid,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
