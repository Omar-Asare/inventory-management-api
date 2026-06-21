const db = require("../config/database");
const AppError = require("../utils/appError");

exports.createCategory = (req, res, next) => {
  const { name, description } = req.body;

  if (!name) {
    return next(new AppError("Category name is required.", 400));
  }

  try {
    const info = db
      .prepare("INSERT INTO categories (name, description) VALUES (?, ?)")
      .run(name, description);

    res.status(201).json({
      status: "success",
      message: "Category created successfully!",
      data: {
        id: info.lastInsertRowid,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getCategories = (req, res, next) => {
  try {
    const categories = db.prepare("SELECT * FROM categories").all();

    res.status(200).json({
      status: "success",
      results: categories.length,
      data: {
        categories,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getCategoryById = (req, res, next) => {
  try {
    const category = db
      .prepare("SELECT * FROM categories WHERE id = ?")
      .get(req.params.id);

    if (!category) {
      return next(new AppError("Category record not found.", 404));
    }

    res.status(200).json({
      status: "success",
      data: {
        category,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateCategory = (req, res, next) => {
  const { name, description } = req.body;
  const { id } = req.params;

  try {
    const category = db
      .prepare("SELECT * FROM categories WHERE id = ?")
      .get(id);

    if (!category) {
      return next(new AppError("Category record not found.", 404));
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

    res.status(200).json({
      status: "success",
      message: "Category updated successfully!",
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteCategory = (req, res, next) => {
  const { id } = req.params;

  try {
    const category = db
      .prepare("SELECT * FROM categories WHERE id = ?")
      .get(id);

    if (!category) {
      return next(new AppError("Category record not found.", 404));
    }

    const linkedProducts = db
      .prepare("SELECT COUNT(*) as count FROM products WHERE category_id = ?")
      .get(id);

    if (linkedProducts.count > 0) {
      return next(
        new AppError(
          "Cannot delete category. There are products currently assigned to it.",
          400,
        ),
      );
    }

    db.prepare("DELETE FROM categories WHERE id = ?").run(id);

    res.status(200).json({
      status: "success",
      message: "Category deleted cleanly from database records.",
    });
  } catch (error) {
    next(error);
  }
};
