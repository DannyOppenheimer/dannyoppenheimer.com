import { useRef, useState } from 'react'
import './App.css'
import GrassField from './GrassField.jsx'
import CursorTrail from './CursorTrail.jsx'
import ProjectsView from './ProjectsView.jsx'

export default function App() {
  const heroRef = useRef(null)
  const nameRef = useRef(null)
  // True while the grass is throwing a dance party (click the profile photo).
  const [dancing, setDancing] = useState(false)
  // The PROJECTS bar's on-screen geometry while the projects "page" is open
  // (null when closed). Set by GrassField on click, cleared when it animates out.
  const [projectsOrigin, setProjectsOrigin] = useState(null)

  return (
    <>
      <header className="hero" ref={heroRef}>
        <GrassField
          containerRef={heroRef}
          nameRef={nameRef}
          onDanceChange={setDancing}
          onOpenProjects={setProjectsOrigin}
          projectsOpen={!!projectsOrigin}
        />
        <h1 className={`hero__name${dancing ? ' hero__name--dancing' : ''}`} ref={nameRef}>
          <span>Danny</span>
          <span>Oppenheimer</span>
        </h1>
        <CursorTrail />
      </header>
      {projectsOrigin && <ProjectsView origin={projectsOrigin} onClose={() => setProjectsOrigin(null)} />}
    </>
  )
}
