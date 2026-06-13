import { Router } from 'express';
import multer from 'multer';
import { scrapeRecipe } from '../services/scraper.js';
import { extractFromImage } from '../services/vision.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/scrape', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  const result = await scrapeRecipe(url);
  if (result.error) return res.status(422).json(result);
  res.json(result);
});

router.post('/vision', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'image file is required' });
  const result = await extractFromImage(req.file.buffer, req.file.mimetype);
  if (result.error) return res.status(422).json(result);
  res.json(result);
});

export default router;
