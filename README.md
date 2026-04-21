# React Go Game (Project 4)

This is a web-based implementation of the classic board game **Go**, built using React, TypeScript, and Vite.

## Features

* **Interactive Go Board**: Developed with React components (`GoBoard.tsx`).
* **Game Rules & Logic**: Core game mechanics handled purely in TypeScript (`GoEngine.ts`).
* **KataGo AI Integration**: Optional AI opponent powered by the [KataGo](https://github.com/lightvector/KataGo) engine via a backend server.
* **Modern Stack**: Blazing fast development server and build process using Vite + React + TypeScript.

## Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Navigate to the project directory.
2. Install the dependencies:

```bash
npm install
```

### Running the App (Frontend Only)

Start the development server:

```bash
npm run dev
```

Open your browser and visit the local URL provided by Vite (usually `http://localhost:5173`) to play the game!

> **Note:** Without a KataGo backend running, the AI will automatically fall back to a heuristic-based local opponent.

---

## KataGo AI Backend Setup

The AI opponent uses the **KataGo** engine via a backend server. You can run it using Docker (recommended) or manually.

### Option 1 – Docker (Recommended)

Make sure you have [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed.

```bash
docker-compose up --build
```

This starts the Node.js KataGo server on **port 8000**.

The server now accepts optional environment variables to tune strength and speed:

```env
KATAGO_DEFAULT_MAX_VISITS=120
KATAGO_EASY_VISITS=40
KATAGO_MEDIUM_VISITS=120
KATAGO_HARD_VISITS=320
```

Higher values play stronger but take longer to respond.

### Option 2 – Manual (Node.js server)

1. Make sure KataGo is installed and its binary path is set via the `KATAGO_PATH` environment variable (default: `/app/katago_dir/katago`).
2. Set the model file path via `MODEL_PATH` (default: `/app/models/model.bin.gz`).
3. Start the backend server:

```bash
node server.js
```

The server listens on port `8000` by default (override with the `PORT` env variable).

### Option 3 – Python FastAPI Backend (in this repo)

A FastAPI KataGo backend is available at `backend/app.py`.

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

### Configuring the Frontend

Copy `.env.example` to `.env.local` and set the backend URL:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
VITE_KATAGO_BACKEND_URL=http://localhost:8000
```

The frontend will automatically use the configured URL when requesting AI moves.
You can also choose the AI difficulty from the board controls in the app.

---

## API Contract

The frontend expects the KataGo backend to implement the following endpoint:

### `POST /api/move`

**Request body:**
```json
{
  "history": ["D4", "Q16", "C3"],
  "difficulty": "medium",
  "board_size": 19
}
```

* `history` – ordered list of GTP move coordinates played so far (Black plays first, then alternating). `"PASS"` is a valid entry.
* `difficulty` – `"easy"`, `"medium"`, or `"hard"`.
* `board_size` – board dimension (default 19).

**Response:**
```json
{
  "ai_move": "D3",
  "score": null
}
```

* `ai_move` – GTP coordinate chosen by the AI (e.g. `"D3"`, `"T19"`, or `"PASS"`).
* `score` – optional score estimate (may be `null`).

---

## Project Structure

* `src/components/GoBoard.tsx`: The UI component for the game board, including AI move logic.
* `src/logic/GoEngine.ts`: The underlying logic handling captures, legal moves, scoring, and game state.
* `src/services/katagoService.ts`: Service module for KataGo API communication and GTP coordinate utilities.
* `server.js`: Node.js KataGo GTP wrapper server (used when running without a Python FastAPI backend).
