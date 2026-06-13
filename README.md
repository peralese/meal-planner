# Meal Planner

A local-first meal planning web app for weekly meal planning, recipe extraction, ingredient tracking, nutrition lookup, and shopping list generation.

## Prerequisites

- **Node.js 18+**
- **Ollama** running locally with the vision model pulled:
  ```
  ollama pull llava:13b
  ```

## Install

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

## Run

Open two terminals:

```bash
# Terminal 1 — Backend (port 3005)
cd backend && node server.js

# Terminal 2 — Frontend (port 5173)
cd frontend && npm run dev
```

## Access

- **Local:** `http://localhost:5173`
- **LAN (from any device on the network):** `http://<your-mac-mini-hostname>.local:5173`

The Vite dev server binds to `0.0.0.0` so it's reachable from any device on the local network.

## Features

- **Week Planner** — Sun–Sat grid, navigate between weeks, add/edit/delete meals
- **Recipe Fetching** — Paste a recipe URL and click "Fetch Recipe" to auto-extract ingredients via JSON-LD scraping
- **Image Extraction** — Upload a photo of a recipe (cookbook, screenshot) → Ollama vision model extracts ingredients with human review before applying
- **Nutrition Lookup** — Per-meal USDA FoodData Central lookup; caches results in SQLite
- **Shopping List** — Aggregated, deduplicated, categorized list with checkboxes; "Copy for Google Keep" outputs a clean plain-text list
- **Nutrition Panel** — Weekly calorie bar chart + per-meal macro breakdown

## Configuration

Edit `backend/.env` to change defaults:

```
PORT=3005
DB_PATH=./data/mealplanner.db

# Image extraction: "openai" or "ollama"
VISION_PROVIDER=openai

# OpenAI image extraction
OPENAI_API_KEY=your_api_key_here
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_VISION_MODEL=gpt-4o-mini

# Ollama image extraction fallback
OLLAMA_BASE_URL=http://localhost:11434
VISION_MODEL=llava:13b

USDA_API_BASE=https://api.nal.usda.gov/fdc/v1
```

## Notes

- The database is created automatically at `backend/data/mealplanner.db` on first run
- No authentication — designed for local network use only
- If Ollama is unavailable, image extraction shows a graceful error; URL scraping and manual entry still work
- USDA nutrition lookup is free with no API key required (rate-limited to 200ms between requests)
