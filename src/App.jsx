import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import GrassField from './GrassField.jsx'
import CursorTrail from './CursorTrail.jsx'
import ProjectsView from './ProjectsView.jsx'
import { DEFAULT_PROJECT_SLUG, PROJECT_SLUGS } from './projects.js'

function projectSlugFromUrl() {
  const hash = window.location.hash
  if (hash === '#projects') return DEFAULT_PROJECT_SLUG
  const match = hash.match(/^#projects\/([^/?#]+)$/)
  if (!match) return null
  const slug = decodeURIComponent(match[1])
  return PROJECT_SLUGS.includes(slug) ? slug : null
}

function projectUrl(slug) {
  return `${window.location.pathname}${window.location.search}#projects/${slug}`
}

function pageUrl() {
  return `${window.location.pathname}${window.location.search}`
}

export default function App() {
  const heroRef = useRef(null)
  const nameRef = useRef(null)
  // True while the grass is throwing a dance party (click the profile photo).
  const [dancing, setDancing] = useState(false)
  // The PROJECTS bar's on-screen geometry while the projects "page" is open
  // (null when closed). Set by GrassField on click, cleared when it animates out.
  const [projectsOrigin, setProjectsOrigin] = useState(null)
  const [projectSlug, setProjectSlug] = useState(projectSlugFromUrl)
  const projectSlugRef = useRef(projectSlug)
  const projectsRestOriginRef = useRef(null)
  const pushedProjectHistoryRef = useRef(false)

  const onProjectsReady = useCallback((origin) => {
    projectsRestOriginRef.current = origin
    if (projectSlugRef.current) setProjectsOrigin(current => current ?? origin)
  }, [])

  const openProjects = useCallback((origin) => {
    const slug = projectSlugRef.current ?? DEFAULT_PROJECT_SLUG
    projectSlugRef.current = slug
    setProjectSlug(slug)
    setProjectsOrigin(origin)
    pushedProjectHistoryRef.current = true
    window.history.pushState(null, '', projectUrl(slug))
  }, [])

  const changeProject = useCallback((slug) => {
    projectSlugRef.current = slug
    setProjectSlug(slug)
    window.history.replaceState(null, '', projectUrl(slug))
  }, [])

  const closeProjects = useCallback(() => {
    setProjectsOrigin(null)
    projectSlugRef.current = null
    setProjectSlug(null)

    if (pushedProjectHistoryRef.current) {
      pushedProjectHistoryRef.current = false
      window.history.back()
    } else if (projectSlugFromUrl()) {
      window.history.replaceState(null, '', pageUrl())
    }
  }, [])

  useEffect(() => {
    const syncFromUrl = () => {
      const slug = projectSlugFromUrl()
      projectSlugRef.current = slug
      setProjectSlug(slug)
      if (slug) {
        setProjectsOrigin(current => current ?? projectsRestOriginRef.current)
      } else {
        setProjectsOrigin(null)
      }
      pushedProjectHistoryRef.current = false
    }

    window.addEventListener('hashchange', syncFromUrl)
    window.addEventListener('popstate', syncFromUrl)
    return () => {
      window.removeEventListener('hashchange', syncFromUrl)
      window.removeEventListener('popstate', syncFromUrl)
    }
  }, [])

  return (
    <>
      <header className="hero" ref={heroRef}>
        <GrassField
          containerRef={heroRef}
          nameRef={nameRef}
          onDanceChange={setDancing}
          onOpenProjects={openProjects}
          onProjectsReady={onProjectsReady}
          projectsOpen={!!projectsOrigin}
        />
        <h1 className={`hero__name${dancing ? ' hero__name--dancing' : ''}`} ref={nameRef}>
          <span>Danny</span>
          <span>Oppenheimer</span>
        </h1>
        <CursorTrail />
      </header>
      {projectsOrigin && (
        <ProjectsView
          origin={projectsOrigin}
          onClose={closeProjects}
          projectSlug={projectSlug}
          onProjectChange={changeProject}
        />
      )}
    </>
  )
}
