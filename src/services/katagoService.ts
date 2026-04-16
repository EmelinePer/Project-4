// KataGo AI backend URL can be configured via environment variable.
// Default falls back to the local Node.js KataGo server (server.js).
const KATAGO_BACKEND_URL =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_KATAGO_BACKEND_URL ?? 'http://localhost:8000';

/**
 * Converts a GTP coordinate string to a board index (e.g., "A19" → 0).
 * Returns -1 for a PASS move or an invalid/out-of-range coordinate.
 */
export function gtpToBoardIndex(move: string, size: number): number {
  const upper = move.toUpperCase().trim();
  if (upper === 'PASS') return -1;

  const colChar = upper.charAt(0);
  const rowStr = upper.slice(1);

  let x = colChar.charCodeAt(0) - 65; // A=0, B=1, …, H=7, J=9, …
  // Compensate for the skipped 'I' – letters from 'I' (x=8) onwards are shifted up by one
  if (x >= 8) x -= 1;

  const row = parseInt(rowStr, 10);
  if (isNaN(row) || row < 1 || row > size) return -1;

  const y = size - row; // Convert GTP row (bottom=1) to board row index (top=0)

  if (x < 0 || x >= size || y < 0 || y >= size) return -1;
  return y * size + x;
}

interface KataGoResponse {
  ai_move: string;
  score: number | null;
}

/**
 * Sends the current GTP move history to the KataGo backend and returns
 * the AI's chosen move as a GTP coordinate string (e.g. "D4" or "PASS").
 *
 * Expected backend format (compatible with FastAPI go_game_browser):
 *   POST /api/move
 *   Body: { history: string[], difficulty: string, board_size: number }
 *   Response: { ai_move: string, score: number | null }
 */
export async function requestKataGoMove(
  history: string[],
  difficulty: string = 'difficult',
  boardSize: number = 19
): Promise<string> {
  console.log(`[KataGo] Requesting move (history length: ${history.length}, difficulty: ${difficulty})`);

  const response = await fetch(`${KATAGO_BACKEND_URL}/api/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history, difficulty, board_size: boardSize })
  });

  if (!response.ok) {
    throw new Error(`KataGo backend responded with HTTP ${response.status}`);
  }

  const data: KataGoResponse = await response.json();

  if (!data.ai_move || typeof data.ai_move !== 'string') {
    throw new Error('Invalid response from KataGo backend: missing "ai_move" field');
  }

  console.log(`[KataGo] Received move: ${data.ai_move} (score: ${data.score ?? 'n/a'})`);
  return data.ai_move;
}
