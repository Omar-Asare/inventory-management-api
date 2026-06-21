const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "../../inventory.db"));

db.exec(`
  -- 1. Users Table
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'staff')) DEFAULT 'staff',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 2. Categories Table
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT
  );
   
  -- 3. Products Table (Aligned with Page 4 Data Model & Page 2 Rules)
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category_id INTEGER,
    price REAL,
    quantity INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 5,
    unit TEXT DEFAULT 'pcs', -- Required Unit of Measure field
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  );

  -- 4. Stock Movements Table Ledger (Aligned with Page 4 Data Model)
  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_id INTEGER, -- Added to record exactly who performed the movement
    type TEXT CHECK(type IN ('in', 'out', 'adjustment')) NOT NULL, -- Added 'adjustment' constraint
    quantity INTEGER NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE, -- Automated cascade purge
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);
try {
  db.prepare(
    "ALTER TABLE products ADD COLUMN is_deleted INTEGER DEFAULT 0;",
  ).run();
} catch (e) {}

console.log("Database tables initialized!");

module.exports = db;
