import './App.css'

export default function App() {
  return (
    <div className="container">
      <header>
        <h1>Danny Oppenheimer</h1>
        <p className="tagline">Your tagline here</p>
        <nav>
          <a href="#about">About</a>
          <a href="#projects">Projects</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <section id="about">
        <h2>About</h2>
        <p>Write a short bio about yourself here.</p>
      </section>

      <section id="projects">
        <h2>Projects</h2>
        <div className="projects-grid">
          <div className="card">
            <h3>Project One</h3>
            <p>Short description of what this project does.</p>
            <a href="#">View →</a>
          </div>
          <div className="card">
            <h3>Project Two</h3>
            <p>Short description of what this project does.</p>
            <a href="#">View →</a>
          </div>
          <div className="card">
            <h3>Project Three</h3>
            <p>Short description of what this project does.</p>
            <a href="#">View →</a>
          </div>
        </div>
      </section>

      <section id="contact">
        <h2>Contact</h2>
        <p>
          <a href="mailto:you@email.com">you@email.com</a>
        </p>
        <p>
          <a href="https://github.com/yourhandle" target="_blank" rel="noreferrer">GitHub</a>
          {' · '}
          <a href="https://linkedin.com/in/yourhandle" target="_blank" rel="noreferrer">LinkedIn</a>
        </p>
      </section>

      <footer>
        <p>© {new Date().getFullYear()} Danny Oppenheimer</p>
      </footer>
    </div>
  )
}
