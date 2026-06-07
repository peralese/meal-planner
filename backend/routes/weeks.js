import { Router } from 'express';
import db from '../db.js';

const router = Router();

function getSundayOfWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().split('T')[0];
}

router.get('/', (req, res) => {
  const weeks = db.prepare('SELECT * FROM weeks ORDER BY week_start DESC').all();
  res.json(weeks);
});

router.get('/current', (req, res) => {
  const weekStart = getSundayOfWeek();
  let week = db.prepare('SELECT * FROM weeks WHERE week_start = ?').get(weekStart);
  if (!week) {
    const result = db.prepare('INSERT INTO weeks (week_start) VALUES (?)').run(weekStart);
    week = db.prepare('SELECT * FROM weeks WHERE id = ?').get(result.lastInsertRowid);
  }
  const meals = db.prepare('SELECT * FROM meals WHERE week_id = ? ORDER BY day_of_week').all(week.id);
  res.json({ ...week, meals });
});

router.get('/:id', (req, res) => {
  const week = db.prepare('SELECT * FROM weeks WHERE id = ?').get(req.params.id);
  if (!week) return res.status(404).json({ error: 'Week not found' });
  const meals = db.prepare('SELECT * FROM meals WHERE week_id = ? ORDER BY day_of_week').all(week.id);
  res.json({ ...week, meals });
});

router.post('/', (req, res) => {
  const { week_start } = req.body;
  if (!week_start) return res.status(400).json({ error: 'week_start is required' });
  try {
    const result = db.prepare('INSERT INTO weeks (week_start) VALUES (?)').run(week_start);
    const week = db.prepare('SELECT * FROM weeks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(week);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      const week = db.prepare('SELECT * FROM weeks WHERE week_start = ?').get(week_start);
      return res.json(week);
    }
    throw err;
  }
});

export default router;
