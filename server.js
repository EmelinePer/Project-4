import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';

const app = express();
app.use(cors());
app.use(express.json());

// NOTE: The paths below correspond to where Docker installs the files
const KATAGO_PATH = process.env.KATAGO_PATH || '/app/katago_dir/katago'; 
const MODEL_PATH = process.env.MODEL_PATH || '/app/models/model.bin.gz'; 

let katagoProcess = null;
let currentResolve = null;

// Keep KataGo running persistently across moves! Starting it up takes multiple seconds.
function startKataGo() {
  if (katagoProcess) return;
  console.log("Booting up KataGo Engine (Singleton)...");
  
  katagoProcess = spawn(KATAGO_PATH, ['gtp', '-model', MODEL_PATH]);
  
  let outputBuffer = '';
  
  katagoProcess.on('error', (err) => {
    console.error('KataGo Process Error:', err);
  });
  katagoProcess.on('exit', (code) => {
    console.error(`KataGo Process Exited with code ${code}`);
    katagoProcess = null;
  });

  katagoProcess.stdout.on('data', (data) => {
    console.log(`[KataGo OUT] ${data.toString()}`);
    outputBuffer += data.toString();
    
    // Check if the output block finishes (KataGo sends an empty line after every response)
    if (outputBuffer.includes('\n\n')) {
      const match = outputBuffer.match(/=\s+([A-Za-z][0-9]+|pass|PASS)/);
      
      // If we found a coordinate move or a PASS and we have a frontend waiting for an answer
      if (match && currentResolve) {
        let finalMove = match[1].toUpperCase();
        currentResolve(finalMove);
        currentResolve = null;
      }
      
      // Clear the buffer after reading the message chunk
      outputBuffer = '';
    }
  });

  katagoProcess.stderr.on('data', (data) => {
    console.error(`KataGo stderr: ${data}`);
  });

  // Limit KataGo so it doesn't take 20 seconds searching deep into the future on a CPU
  katagoProcess.stdin.write('kata-set-param maxVisits 50\n');
}

// Boot up immediately when the server starts
startKataGo();

/**
 * POST /api/move
 *
 * Accepts the GTP move history format used by the frontend and FastAPI backends:
 *   { history: string[], board_size: number, difficulty?: string }
 *
 * Returns:
 *   { ai_move: string, score: null }
 */
app.post('/api/move', (req, res) => {
  const { history, board_size: boardSize = 19, difficulty = 'medium' } = req.body;

  if (!Array.isArray(history)) {
    return res.status(400).json({ error: 'Request body must include a "history" array of GTP moves.' });
  }

  if (!katagoProcess || katagoProcess.killed) startKataGo();

  // Determine whose turn it is from move history length (B plays on even turns)
  const turn = history.filter(m => m !== 'PASS').length % 2 === 0 ? 'B' : 'W';
  console.log(`[Server] Move request — history: ${history.length} moves, turn: ${turn}, difficulty: ${difficulty}`);

  // Reset the board and replay the full move history
  katagoProcess.stdin.write(`boardsize ${boardSize}\n`);
  katagoProcess.stdin.write('clear_board\n');

  for (let idx = 0; idx < history.length; idx++) {
    // Alternate colors: Black plays first (index 0), White second, etc.
    const color = idx % 2 === 0 ? 'B' : 'W';
    katagoProcess.stdin.write(`play ${color} ${history[idx]}\n`);
  }

  // Set up the callback for when KataGo's async output buffer finds the move
  currentResolve = (finalMove) => {
    res.json({ ai_move: finalMove, score: null });
  };

  // Request a move for the current player
  katagoProcess.stdin.write(`genmove ${turn}\n`);
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`KataGo AI Server running on http://localhost:${PORT}`);
  console.log(`Accepting history-based move requests at POST /api/move`);
});
