import { useRef, useState } from 'react'
import './App.css'
import GrassField from './GrassField.jsx'

export default function App() {
  const heroRef = useRef(null)
  const nameRef = useRef(null)
  // True while the grass is throwing a dance party (click the profile photo).
  const [dancing, setDancing] = useState(false)

  return (
    <header className="hero" ref={heroRef}>
      <GrassField containerRef={heroRef} nameRef={nameRef} onDanceChange={setDancing} />
      <h1 className={`hero__name${dancing ? ' hero__name--dancing' : ''}`} ref={nameRef}>
        <span>Danny</span>
        <span>Oppenheimer</span>
      </h1>
    </header>
  )
}
