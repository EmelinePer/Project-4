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

app.post('/api/move', (req, res) => {
  const { size, board, turn } = req.body;
  if (!katagoProcess || katagoProcess.killed) startKataGo();

  console.log(`Frontend requested a move for: ${turn}`);

  // Instruct the persistent KataGo instance to consider the current board
  katagoProcess.stdin.write(`boardsize ${size}\n`);
  katagoProcess.stdin.write('clear_board\n');
  
  // Re-place all stones currently on the board
  for (let i = 0; i < board.length; i++) {
    if (board[i]) {
      const x = i % size;
      const y = Math.floor(i / size);
      const col = String.fromCharCode(65 + (x >= 8 ? x + 1 : x)); // Skip 'I' in GTP
      const row = size - y;
      katagoProcess.stdin.write(`play ${board[i]} ${col}${row}\n`);
    }
  }
  
  // Set up the callback for when KataGo's async output buffer finds the move
  currentResolve = (finalMove) => {
    res.json({ move: finalMove });
  };
  
  // Request a move
  katagoProcess.stdin.write(`genmove ${turn}\n`);
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`KataGo AI Server running on http://localhost:${PORT}`);
  console.log(`Ready to play fast!`);
});
