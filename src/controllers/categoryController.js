const db = require("../config/database");

exports.createCategory = (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Category name is required." });
  }

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

exports.getCategories = (req, res) => {
  try {
    const categories = db.prepare("SELECT * FROM categories").all();
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getCategoryById = (req, res) => {
  try {
    const category = db
      .prepare("SELECT * FROM categories WHERE id = ?")
      .get(req.params.id);

    if (!category) {
      return res.status(404).json({ error: "Category not found." });
    }
    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateCategory = (req, res) => {
  const { name, description } = req.body;
  const { id } = req.params;

  try {
    const category = db
      .prepare("SELECT * FROM categories WHERE id = ?")
      .get(id);
    if (!category) {
      return res.status(404).json({ error: "Category not found." });
    }

    const stmt = db.prepare(`
      UPDATE categories 
      SET name = ?, description = ? 
      WHERE id = ?
    `);

    stmt.run(
      name || category.name,
      description !== undefined ? description : category.description,
      id,
    );

    res.status(200).json({ message: "Category updated successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteCategory = (req, res) => {
  const { id } = req.params;

  try {
    const category = db
      .prepare("SELECT * FROM categories WHERE id = ?")
      .get(id);
    if (!category) {
      return res.status(404).json({ error: "Category not found." });
    }

    const linkedProducts = db
      .prepare("SELECT COUNT(*) as count FROM products WHERE category_id = ?")
      .get(id);
    if (linkedProducts.count > 0) {
      return res.status(400).json({
        error:
          "Cannot delete category. There are products currently assigned to it.",
      });
    }

    db.prepare("DELETE FROM categories WHERE id = ?").run(id);
    res.status(200).json({ message: "Category deleted cleanly." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
