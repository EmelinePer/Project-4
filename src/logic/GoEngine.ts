type Player = 'B' | 'W' | null;

export class GoEngine {
  size: number;
  board: Player[];
  history: string[] = []; // For Ko Rule detection
  moveHistory: string[] = []; // GTP move history (e.g. ["D4", "Q16", "PASS"]) for KataGo API
  captures = { B: 0, W: 0 }; // Track captured stones
  stonesRemaining = { B: 181, W: 180 }; // Track remaining pieces
  consecutivePasses: number = 0; // Tracks passes to end the game
  komi: number = 6.5; // Compensation points for White
  isResigned: Player = null;
  lastMoveIndex: number | null = null;

  constructor(size: number = 19) {
    this.size = size;
    this.board = Array(size * size).fill(null);
  }

  // Get index from coordinates
  getIndex(x: number, y: number) {
    return y * this.size + x;
  }

  // Convert a board index to a GTP coordinate string (e.g. 0 → "A19").
  // GTP skips the letter 'I', and rows are numbered from 1 at the bottom.
  private indexToGtp(index: number): string {
    const x = index % this.size;
    const y = Math.floor(index / this.size);
    const colChar = String.fromCharCode(65 + (x >= 8 ? x + 1 : x));
    const row = this.size - y;
    return `${colChar}${row}`;
  }

  // Find all connected stones of the same color (a "string")
  getGroup(index: number) {
    const color = this.board[index];
    if (!color) return { stones: new Set<number>(), liberties: new Set<number>() };

    const stones = new Set<number>();
    const liberties = new Set<number>();
    const stack = [index];

    while (stack.length > 0) {
      const curr = stack.pop()!;
      if (stones.has(curr)) continue;
      stones.add(curr);

      const neighbors = this.getNeighbors(curr);
      neighbors.forEach(n => {
        if (this.board[n] === color) stack.push(n);
        else if (this.board[n] === null) liberties.add(n);
      });
    }
    return { stones, liberties };
  }

  getNeighbors(index: number) {
    const neighbors = [];
    const x = index % this.size;
    const y = Math.floor(index / this.size);

    if (x > 0) neighbors.push(index - 1);
    if (x < this.size - 1) neighbors.push(index + 1);
    if (y > 0) neighbors.push(index - this.size);
    if (y < this.size - 1) neighbors.push(index + this.size);
    return neighbors;
  }

  placeStone(index: number, player: 'B' | 'W'): boolean {
    if (this.board[index] !== null) return false;
    if (this.stonesRemaining[player] <= 0) return false;

    const originalBoard = [...this.board];
    this.board[index] = player;
    
    // 1. Check for captures of the opponent
    const opponent = player === 'B' ? 'W' : 'B';
    let capturedAny = false;
    let turnCaptures = 0;
    this.getNeighbors(index).forEach(n => {
      if (this.board[n] === opponent) {
        const { liberties, stones } = this.getGroup(n);
        if (liberties.size === 0) {
          stones.forEach(s => {
            this.board[s] = null;
            turnCaptures++;
          });
          capturedAny = true;
        }
      }
    });

    // 2. Check for suicide (illegal unless it captures something)
    const { liberties } = this.getGroup(index);
    if (liberties.size === 0 && !capturedAny) {
      this.board = originalBoard; // Undo
      return false; 
    }

    // 3. Ko Rule (Simplistic: check if board state existed before)
    const stateStr = JSON.stringify(this.board);
    if (this.history.includes(stateStr)) {
      this.board = originalBoard;
      return false; 
    }
    
    this.history.push(stateStr);
    this.moveHistory.push(this.indexToGtp(index));
    this.stonesRemaining[player]--;
    this.captures[player] += turnCaptures;
    this.consecutivePasses = 0; // Reset passes on valid move
    this.lastMoveIndex = index;
    return true;
  }

  passTurn(): void {
    this.consecutivePasses++;
    this.moveHistory.push('PASS');
    this.history.push("PASS_" + this.history.length); // Add distinct state for Ko history pacing
  }

  resign(player: Player): void {
    this.isResigned = player;
  }

  isGameOver(): boolean {
    return this.consecutivePasses >= 2 || this.isResigned !== null;
  }

  // Calculate score using Area Scoring (Chinese rules) to automatically infer territory when possible
  computeScore() {
    let blackArea = 0;
    let whiteArea = 0;
    let visitedEmpty = new Set<number>();

    for (let i = 0; i < this.board.length; i++) {
      if (this.board[i] === 'B') {
        blackArea++; // Stone on board
      } else if (this.board[i] === 'W') {
        whiteArea++; // Stone on board
      } else if (!visitedEmpty.has(i)) {
        // Flood fill to determine if this empty space is surrounded entirely by one color
        const stack = [i];
        const currentGroup = new Set<number>();
        let bordersBlack = false;
        let bordersWhite = false;

        while (stack.length > 0) {
          const curr = stack.pop()!;
          if (currentGroup.has(curr)) continue;
          currentGroup.add(curr);
          visitedEmpty.add(curr);

          this.getNeighbors(curr).forEach(n => {
            if (this.board[n] === 'B') bordersBlack = true;
            else if (this.board[n] === 'W') bordersWhite = true;
            else if (this.board[n] === null && !currentGroup.has(n)) stack.push(n);
          });
        }

        // Assign territory points if surrounded exclusively by one color
        if (bordersBlack && !bordersWhite) blackArea += currentGroup.size;
        if (bordersWhite && !bordersBlack) whiteArea += currentGroup.size;
      }
    }

    return {
      blackArea,
      whiteArea: whiteArea + this.komi // Add Komi to White's score
    };
  }
}