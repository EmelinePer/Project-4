import React, { useState, useMemo, useEffect } from 'react';
import { GoEngine } from "../logic/GoEngine";

interface GoBoardProps {
  onScoreUpdate: (blackCaptures: number, whiteCaptures: number) => void;
}

const GoBoard: React.FC<GoBoardProps> = ({ onScoreUpdate }) => {
  const [engine, setEngine] = useState(() => new GoEngine(19));
  const [board, setBoard] = useState(engine.board);
  const [turn, setTurn] = useState<'B' | 'W'>('B');
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);
  const [gameMode, setGameMode] = useState<'PvP' | 'PvAI' | 'AIvAI'>('PvAI');
  const [lastMove, setLastMove] = useState<number | null>(null);

  // Trigger score update when component mounts to initialize the scoreboard
  useEffect(() => {
    onScoreUpdate(engine.captures.B, engine.captures.W);
  }, [engine, onScoreUpdate]);

  useEffect(() => {
    if (engine.isGameOver()) return;
    
    let isAITurn = false;
    if (gameMode === 'AIvAI') isAITurn = true;
    if (gameMode === 'PvAI' && turn === 'W') isAITurn = true;

    if (isAITurn) {
      const timer = setTimeout(() => aiMove(turn), 600);
      return () => clearTimeout(timer);
    }
  }, [turn, gameMode, board, engine]);

  const handleClick = (i: number) => {
    if (engine.isGameOver()) return; // Bloquer les clics si c'est fini

    if (gameMode === 'AIvAI') return;
    if (gameMode === 'PvAI' && turn === 'W') return;

    if (engine.placeStone(i, turn)) {
      setBoard([...engine.board]);
      setLastMove(engine.lastMoveIndex);
      setTurn(turn === 'B' ? 'W' : 'B');
      onScoreUpdate(engine.captures.B, engine.captures.W);
    }
  };

  const aiMove = (currentColor: 'B' | 'W') => {
    const captureMoves: number[] = [];
    const defenseMoves: number[] = [];
    const proximityMoves: number[] = [];

    // Analyze board to find critical spots (groups with 1 liberty)
    for (let i = 0; i < engine.board.length; i++) {
      const color = engine.board[i];
      if (color) {
        const { liberties } = engine.getGroup(i);
        if (liberties.size === 1) {
          const criticalSpot = Array.from(liberties)[0];
          if (color !== currentColor) captureMoves.push(criticalSpot); // Capture opponent
          if (color === currentColor) defenseMoves.push(criticalSpot); // Save own pieces
        }
      }
    }

    const emptyIndices = engine.board.map((v, i) => v === null ? i : null).filter(v => v !== null) as number[];
    if (emptyIndices.length === 0) return;

    for (const idx of emptyIndices) {
      if (engine.getNeighbors(idx).some(n => engine.board[n] !== null)) {
        proximityMoves.push(idx);
      }
    }

    const attemptMoves = [
      ...captureMoves.sort(() => Math.random() - 0.5),
      ...defenseMoves.sort(() => Math.random() - 0.5),
      ...proximityMoves.sort(() => Math.random() - 0.5),
      ...emptyIndices.sort(() => Math.random() - 0.5)
    ];

    for (const move of attemptMoves) {
      if (engine.placeStone(move, currentColor)) {
        setBoard([...engine.board]);
        setLastMove(engine.lastMoveIndex);
        setTurn(currentColor === 'B' ? 'W' : 'B');
        onScoreUpdate(engine.captures.B, engine.captures.W);
        return;
      }
    }

    // SI AUCUN COUP VALIDE -> L'IA PASSE
    engine.passTurn();
    setTurn(currentColor === 'B' ? 'W' : 'B');
  };

  const resetGame = () => {
    const newEngine = new GoEngine(19);
    setEngine(newEngine);
    setBoard(newEngine.board);
    setTurn('B');
    setLastMove(null);
  };

  const passTurn = () => {
    engine.passTurn();
    setTurn(turn === 'B' ? 'W' : 'B');
  };

  const resignGame = () => {
    engine.resign(turn);
    setTurn(turn === 'B' ? 'W' : 'B'); // Just to trigger a rerender
  };

  const finalScore = useMemo(() => engine.isGameOver() ? engine.computeScore() : null, [engine.isGameOver(), board]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px', width: '100%', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* BARRE DE CONTRÔLES SUPÉRIEURE (Style Hyper Moderne) */}
      <div style={{ 
        display: 'flex', 
        gap: '15px', 
        padding: '12px 24px', 
        background: 'rgba(255, 255, 255, 0.05)', 
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '50px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
      }}>
        <button 
          onClick={resetGame}
          style={{ 
            padding: '10px 25px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', 
            color: '#fca5a5', cursor: 'pointer', fontSize: '1rem', fontWeight: '500', borderRadius: '30px',
            transition: 'all 0.2s ease-in-out'
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          New Game
        </button>

        <button 
          onClick={passTurn}
          disabled={gameMode === 'AIvAI' || (gameMode === 'PvAI' && turn === 'W') || engine.isGameOver()}
          style={{
            padding: '10px 25px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)',
            color: '#93c5fd', cursor: gameMode === 'AIvAI' || (gameMode === 'PvAI' && turn === 'W') || engine.isGameOver() ? 'not-allowed' : 'pointer', fontSize: '1rem', fontWeight: '500', borderRadius: '30px',
            opacity: gameMode === 'AIvAI' || (gameMode === 'PvAI' && turn === 'W') || engine.isGameOver() ? 0.4 : 1, transition: 'all 0.2s ease-in-out'
          }}
          onMouseOver={(e) => { if(!(gameMode === 'AIvAI' || (gameMode === 'PvAI' && turn === 'W')) && !engine.isGameOver()) { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          Pass Turn
        </button>

        <button
          onClick={resignGame}
          disabled={gameMode === 'AIvAI' || (gameMode === 'PvAI' && turn === 'W') || engine.isGameOver()}
          style={{
            padding: '10px 25px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5', cursor: gameMode === 'AIvAI' || (gameMode === 'PvAI' && turn === 'W') || engine.isGameOver() ? 'not-allowed' : 'pointer', fontSize: '1rem', fontWeight: '500', borderRadius: '30px',
            opacity: gameMode === 'AIvAI' || (gameMode === 'PvAI' && turn === 'W') || engine.isGameOver() ? 0.4 : 1, transition: 'all 0.2s ease-in-out'
          }}
          onMouseOver={(e) => { if(!(gameMode === 'AIvAI' || (gameMode === 'PvAI' && turn === 'W')) && !engine.isGameOver()) { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          Resign
        </button>

        <select
          value={gameMode}
          onChange={(e) => {
            setGameMode(e.target.value as any);
            const newEngine = new GoEngine(19);
            setEngine(newEngine);
            setBoard(newEngine.board);
            setTurn('B');
            setLastMove(null);
          }}
          style={{
            padding: '10px 15px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#e5e5e5', fontSize: '1rem', fontWeight: '500', borderRadius: '30px', outline: 'none', cursor: 'pointer'
          }}
        >
          <option value="PvP" style={{ background: '#222' }}>👤 Player vs Player</option>
          <option value="PvAI" style={{ background: '#222' }}>🤖 Player vs AI</option>
          <option value="AIvAI" style={{ background: '#222' }}>🖥️ AI vs AI</option>
        </select>
      </div>

      {/* ZONE DE JEU (Plateau + Panneau Latéral) */}
      <div style={{ display: 'flex', gap: '50px', justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        
        {/* PLATEAU */}
        <div style={{ 
          display: 'inline-block', 
          background: '#fad561', 
          border: '12px solid #5c3a21', // Contour plus large type bois
          borderRadius: '4px', // Bords légèrement arrondis
          padding: '20px', 
          boxShadow: 'inset 0 0 15px rgba(0,0,0,0.3), 0px 15px 35px rgba(0,0,0,0.5)', // Ombre interne (inset) et externe pour 3D
          borderTopColor: '#7a5135',
          borderLeftColor: '#6e452a',
          borderRightColor: '#4f301b',
          borderBottomColor: '#3a2212' // L'effet de lumière sur les 4 bordures boisées
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(19, 30px)' }}>
        {board.map((cell, i) => {
          const x = i % 19;
          const y = Math.floor(i / 19);
          const isHoshi = [3, 9, 15].includes(x) && [3, 9, 15].includes(y);

          return (
            <div 
              key={i} 
              onClick={() => handleClick(i)}
              onMouseEnter={() => setHoveredCell(i)}
              onMouseLeave={() => setHoveredCell(null)}
              style={{
                position: 'relative',
                width: '30px', height: '30px', 
                cursor: cell === null && ((gameMode === 'PvP') || (gameMode === 'PvAI' && turn === 'B')) ? 'pointer' : 'default',
                display: 'flex', justifyContent: 'center', alignItems: 'center'
              }}
            >
              {/* Ligne horizontale */}
              <div style={{ 
                position: 'absolute', top: '14px', height: '1px', background: '#000', 
                left: x === 0 ? '14px' : '0', right: x === 18 ? '14px' : '0', zIndex: 1 
              }} />
              
              {/* Ligne verticale */}
              <div style={{ 
                position: 'absolute', left: '14px', width: '1px', background: '#000', 
                top: y === 0 ? '14px' : '0', bottom: y === 18 ? '14px' : '0', zIndex: 1 
              }} />

              {/* Point noir (Hoshi) */}
              {isHoshi && (
                <div style={{ position: 'absolute', width: '6px', height: '6px', background: '#222', borderRadius: '50%', zIndex: 2 }} />
              )}

              {/* Pierre jouée (Jeton) */}
              {cell && (
                <div style={{
                  position: 'absolute',
                  width: '26px', height: '26px',
                  borderRadius: '50%',
                  // Différents gradients pour l'effet lumière sur pierre bombée
                  background: cell === 'B' 
                    ? 'radial-gradient(circle at 30% 30%, #555, #111 40%, #000 80%)' 
                    : 'radial-gradient(circle at 30% 30%, #fff, #f0f0f0 40%, #dcdcdc 80%)',
                  boxShadow: '1px 3px 5px rgba(0,0,0,0.6)', // Plus d'ombre portée pour le volume
                  zIndex: 3
                }} />
              )}

              {cell && lastMove === i && (
                <div style={{
                  position: 'absolute',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: cell === 'B' ? '#fff' : '#111',
                  border: cell === 'B' ? '1px solid #111' : '1px solid #fff',
                  zIndex: 4,
                  boxShadow: '0 0 6px rgba(0,0,0,0.45)'
                }} />
              )}

              {/* Prévisualisation au survol */}
              {cell === null && hoveredCell === i && ((gameMode === 'PvP') || (gameMode === 'PvAI' && turn === 'B')) && (
                <div style={{
                  position: 'absolute',
                  width: '26px', height: '26px',
                  borderRadius: '50%',
                  background: turn === 'B' ? '#111' : '#fff',
                  opacity: 0.5,
                  zIndex: 3
                }} />
              )}
            </div>
          );
        })}
      </div>
      </div>

      {/* PANNEAU LATÉRAL HYPER-MODERN (Score + Tour) */}
      <div style={{
           display: 'flex', 
           flexDirection: 'column', 
           gap: '20px', 
           minWidth: '280px',
           maxWidth: '350px'
      }}>
          
          {/* INDICATEUR DE TOUR / FIN DE JEU */}
          <div style={{ 
            padding: '24px', 
            background: engine.isGameOver() 
              ? 'linear-gradient(145deg, rgba(239, 68, 68, 0.1) 0%, rgba(153, 27, 27, 0.4) 100%)' 
              : 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.4) 100%)', 
            border: engine.isGameOver() ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px'
          }}>
             <h3 style={{ 
               color: engine.isGameOver() ? '#fca5a5' : '#f7f4f4', 
               margin: '0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '3px', fontWeight: '500' 
             }}>
               {engine.isGameOver() ? 'Game Status' : 'Current Turn'}
             </h3>
             <div style={{
               display: 'flex', alignItems: 'center', gap: '15px',
               color: engine.isGameOver() ? '#ef4444' : (turn === 'B' ? '#fff' : '#ddd'),
               fontSize: engine.isGameOver() ? '1.5rem' : '1.4rem', 
               fontWeight: '600', textAlign: 'center'
             }}>
               {!engine.isGameOver() && (
                 <div style={{ 
                   width: '24px', height: '24px', borderRadius: '50%', 
                   background: turn === 'B' ? '#000' : '#fff',
                   border: '2px solid rgba(255,255,255,0.2)',
                   boxShadow: turn === 'B' ? '0 0 15px rgba(0,0,0,0.8)' : '0 0 15px rgba(255,255,255,0.6)',
                   transition: 'all 0.3s ease'
                 }} />
               )}
               {engine.isGameOver()
                 ? (engine.isResigned ? `${engine.isResigned === 'B' ? 'White' : 'Black'} Wins (Resign)` : 'Game Finished')
                 : (gameMode === 'AIvAI' ? `AI (${turn === 'B' ? 'Black' : 'White'}) Thinking...` : (gameMode === 'PvAI' && turn === 'W' ? 'White (AI)' : (turn === 'B' ? (gameMode === 'PvP' ? 'Black (P1)' : 'Black (You)') : 'White (P2)')))}
             </div>
          </div>

          {/* COMPTEUR DE SCORE STATIQUE (Captures actuelles) */}
          {!engine.isGameOver() && (
          <div style={{ 
            padding: '24px', 
            background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.3) 100%)', 
            border: '1px solid rgba(255, 255, 255, 0.05)', 
            borderRadius: '16px',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
          }}>
            <h3 style={{ color: '#ccc', margin: '0 0 20px 0', fontSize: '0.85rem', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '3px', fontWeight: '500' }}>
              Game Score
            </h3>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', padding: '10px 15px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '14px', height: '14px', background: '#000', borderRadius: '50%', border: '1px solid #666666' }} />
                <span style={{ color: '#ccc', fontSize: '1rem', fontWeight: '500' }}>Black</span>
              </div>
              <span style={{ color: '#ccc', fontSize: '1.4rem', fontWeight: '600', textShadow: '0 0 10px rgba(255,255,255,0.2)' }}>{engine.captures.B}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '14px', height: '14px', background: '#fff', borderRadius: '50%', border: '1px solid #ccc' }} />
                <span style={{ color: '#ccc', fontSize: '1rem', fontWeight: '500' }}>White</span>
              </div>
              <span style={{ color: '#ccc', fontSize: '1.4rem', fontWeight: '600', textShadow: '0 0 10px rgba(255,255,255,0.2)' }}>{engine.captures.W}</span>
            </div>
          </div>
          )}

          {/* RÉSULTAT FINAL (COMPTE AREA SCORING & KOMI) */}
          {engine.isGameOver() && finalScore && (
          <div style={{ 
            padding: '24px', 
            background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.1) 0%, rgba(4, 120, 87, 0.4) 100%)', 
            border: '1px solid rgba(16, 185, 129, 0.3)', 
            borderRadius: '16px',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            animation: 'fadeIn 0.5s ease-in-out'
          }}>
            <h3 style={{ color: '#6ee7b7', margin: '0 0 20px 0', fontSize: '0.85rem', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '3px', fontWeight: '500' }}>
              Final Area Score
            </h3>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <span style={{ color: '#ccc', fontSize: '1rem' }}>Black (Area)</span>
              <span style={{ color: finalScore.blackArea > finalScore.whiteArea ? '#fff' : '#aaa', fontSize: '1.4rem', fontWeight: '600' }}>
                {finalScore.blackArea} pts
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <span style={{ color: '#ccc', fontSize: '1rem' }}>White (Area)</span>
              <span style={{ color: finalScore.whiteArea > finalScore.blackArea ? '#fff' : '#aaa', fontSize: '1.4rem', fontWeight: '600' }}>
                {finalScore.whiteArea - engine.komi} pts
              </span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', color: '#999', fontSize: '0.85rem' }}>
              <span>+ Komi</span>
              <span>{engine.komi} pts</span>
            </div>

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '15px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.1rem', fontWeight: 'bold' }}>
              <span style={{ color: '#fff' }}>TOTAL WHITE</span>
              <span style={{ color: finalScore.whiteArea > finalScore.blackArea ? '#6ee7b7' : '#fff' }}>{finalScore.whiteArea} pts</span>
            </div>
          </div>
          )}

      </div>
    </div>
    </div>
  );
};

export default GoBoard;