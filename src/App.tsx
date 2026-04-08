import { useState } from 'react'
import GoBoard from './components/GoBoard'
import './App.css'

function App() {
  const [scores, setScores] = useState({ black: 0, white: 0 });

  return (
    <div className="main-container">
      <header style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h1 style={{ color: '#fad561', fontSize: '3rem', margin: '0 0 30px 0', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
          Go Games / Jeu de Go / 围棋 - Projet 4
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#ccc', margin: '0' }}>
          Click on the intersections to place a stone.
        </p>
      </header>

      <section id="game-area">
        <GoBoard onScoreUpdate={(b, w) => setScores({ black: b, white: w })} />
      </section>

      <footer>
        <p>Emeline Perroux, Fatine Knidla</p>
      </footer>
    </div>
  )
}

export default App