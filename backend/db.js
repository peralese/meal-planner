import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, process.env.DB_PATH || './data/mealplanner.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS weeks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_id INTEGER NOT NULL REFERENCES weeks(id),
    day_of_week INTEGER NOT NULL,
    meal_name TEXT NOT NULL,
    recipe_url TEXT,
    notes TEXT,
    servings INTEGER DEFAULT 4,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity TEXT,
    unit TEXT,
    usda_fdc_id INTEGER,
    calories_per_serving REAL,
    protein_g REAL,
    carbs_g REAL,
    fat_g REAL
  );

  CREATE TABLE IF NOT EXISTS nutrition_cache (
    name TEXT PRIMARY KEY,
    usda_fdc_id INTEGER,
    calories_per_serving REAL,
    protein_g REAL,
    carbs_g REAL,
    fat_g REAL,
    cached_at TEXT DEFAULT (datetime('now'))
  );
`);

export default db;
