const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "../../inventory.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS categories(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
   name TEXT NOT Null,
    description TEXT
  );
   
   CREATE TABLE IF NOT EXISTS products(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category_id INTEGER,
    price REAL,
    quantity INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 5,
    FOREIGN KEY (category_id) REFERENCES categories(id)
   );
  `);

console.log("Database tables initialized!");

module.exports = db;
