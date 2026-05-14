const db = require("../config/database");

exports.createCategory = (req, res) => {
  const { name, description } = req.body;
  try {
    const info = db
      .prepare("INSERT INTO categories (name, description) VALUES (?, ?)")
      .run(name, description);
    res
      .status(201)
      .json({ message: "categories created!", id: info.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
