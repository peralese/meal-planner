import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import weeksRouter from './routes/weeks.js';
import mealsRouter from './routes/meals.js';
import recipesRouter from './routes/recipes.js';
import nutritionRouter from './routes/nutrition.js';
import shoppingRouter from './routes/shopping.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

app.use('/api/weeks', weeksRouter);
app.use('/api/meals', mealsRouter);
app.use('/api/recipes', recipesRouter);
app.use('/api/nutrition', nutritionRouter);
app.use('/api/shopping', shoppingRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Meal planner backend running on port ${PORT}`);
});
