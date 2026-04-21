import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';

const app = express();
app.use(cors());
app.use(express.json());

// NOTE: The paths below correspond to where Docker installs the files
const KATAGO_PATH = process.env.KATAGO_PATH || '/app/katago_dir/katago';
const MODEL_PATH = process.env.MODEL_PATH || '/app/models/model.bin.gz';
const CONFIG_PATH = process.env.CONFIG_PATH || '/app/gtp_config.cfg';
const MOVE_TIMEOUT_MS = 30000; // 30-second timeout per move request
const DEFAULT_MAX_VISITS = Number(process.env.KATAGO_DEFAULT_MAX_VISITS || 120);
const VISITS_BY_DIFFICULTY = {
  easy: Number(process.env.KATAGO_EASY_VISITS || 40),
  medium: Number(process.env.KATAGO_MEDIUM_VISITS || 120),
  hard: Number(process.env.KATAGO_HARD_VISITS || 320),
};

let katagoProcess = null;

// Queue ensures only one GTP request is in-flight at a time, preventing
// stdout pipe corruption when concurrent HTTP requests arrive.
let requestQueue = Promise.resolve();

function isKataGoWritable() {
  return Boolean(
    katagoProcess &&
    katagoProcess.stdin &&
    !katagoProcess.stdin.destroyed &&
    katagoProcess.stdin.writable
  );
}

function writeKataGoCommand(command) {
  if (!isKataGoWritable()) {
    throw new Error('KataGo stdin is not writable');
  }
  katagoProcess.stdin.write(`${command}\n`);
}

// Keep KataGo running persistently across moves! Starting it up takes multiple seconds.
function startKataGo() {
  if (katagoProcess && !katagoProcess.killed) return;
  console.log("Booting up KataGo Engine (Singleton)...");

  katagoProcess = spawn(KATAGO_PATH, ['gtp', '-model', MODEL_PATH, '-config', CONFIG_PATH]);

  katagoProcess.on('error', (err) => {
    console.error('KataGo Process Error:', err);
    katagoProcess = null;
  });
  katagoProcess.on('exit', (code) => {
    console.error(`KataGo Process Exited with code ${code}`);
    katagoProcess = null;
  });
  katagoProcess.stdin.on('error', (err) => {
    console.error('KataGo stdin error:', err.message);
  });

  katagoProcess.stderr.on('data', (data) => {
    console.error(`KataGo stderr: ${data}`);
  });

  // Use a reasonable default search budget; the request-specific value can override it.
  try {
    writeKataGoCommand(`kata-set-param maxVisits ${DEFAULT_MAX_VISITS}`);
  } catch (err) {
    console.error('Failed to initialize KataGo parameters:', err.message);
  }
}

/**
 * Sends a batch of GTP commands and waits for all responses, then reads the
 * final genmove response.  Returns the move string (e.g. "D4" or "PASS").
 */
function sendGtpCommands(commands) {
  return new Promise((resolve, reject) => {
    let outputBuffer = '';
    let expectedResponses = commands.length;
    let responsesReceived = 0;
    let finalMove = null;
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        katagoProcess.stdout.removeListener('data', onData);
        reject(new Error('KataGo timed out'));
      }
    }, MOVE_TIMEOUT_MS);

    function onData(data) {
      outputBuffer += data.toString();

      // Each GTP response ends with a blank line (\n\n)
      let boundary;
      while ((boundary = outputBuffer.indexOf('\n\n')) !== -1) {
        const block = outputBuffer.slice(0, boundary);
        outputBuffer = outputBuffer.slice(boundary + 2);
        responsesReceived++;

        if (responsesReceived === expectedResponses) {
          // This is the genmove response — extract the move coordinate
          const match = block.match(/^=\s*([A-Za-z][0-9]+|pass|PASS|resign|RESIGN)/im);
          if (match) {
            finalMove = match[1].toUpperCase();
          } else {
            console.warn(`[Server] Failed to parse KataGo genmove response: "${block}" — defaulting to PASS`);
            finalMove = 'PASS'; // Fallback if parsing fails
          }

          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            katagoProcess.stdout.removeListener('data', onData);
            resolve(finalMove);
          }
          break;
        }
      }
    }

    katagoProcess.stdout.on('data', onData);

    // Send all commands
    try {
      for (const cmd of commands) {
        writeKataGoCommand(cmd);
      }
    } catch (err) {
      clearTimeout(timeout);
      katagoProcess.stdout.removeListener('data', onData);
      reject(err);
    }
  });
}

// Boot up immediately when the server starts
startKataGo();

/**
 * POST /api/move
 *
 * Accepts the GTP move history format used by the frontend:
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

  const maxVisits = VISITS_BY_DIFFICULTY[difficulty] ?? DEFAULT_MAX_VISITS;

  // Determine whose turn it is — in GTP, PASS alternates turns like any other move,
  // so history.length (including PASSes) correctly tracks whose turn it is.
  const turn = history.length % 2 === 0 ? 'B' : 'W';
  console.log(`[Server] Move request — history: ${history.length} moves, turn: ${turn}, difficulty: ${difficulty}`);

  // Serialise all requests through the queue so only one is active at a time
  requestQueue = requestQueue.then(async () => {
    try {
      // Build the full command batch
      const commands = [
        `boardsize ${boardSize}`,
        'clear_board',
        `kata-set-param maxVisits ${maxVisits}`,
      ];

      for (let idx = 0; idx < history.length; idx++) {
        const color = idx % 2 === 0 ? 'B' : 'W';
        commands.push(`play ${color} ${history[idx]}`);
      }

      commands.push(`genmove ${turn}`);

      const finalMove = await sendGtpCommands(commands);
      res.json({ ai_move: finalMove, score: null });
    } catch (err) {
      console.error('[Server] Error during KataGo request:', err.message);
      // Restart KataGo if it crashed during this request
      katagoProcess = null;
      startKataGo();
      res.status(500).json({ error: 'KataGo failed to generate a move.' });
    }
  });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`KataGo AI Server running on http://localhost:${PORT}`);
  console.log(`Accepting history-based move requests at POST /api/move`);
});
