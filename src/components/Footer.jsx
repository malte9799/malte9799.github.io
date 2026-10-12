import { GITHUB_URL } from '../data/projects';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <p>
          © {new Date().getFullYear()} Malte. Built with React, Three.js and Motion. Text effects adapted from{' '}
          <a href="https://reactbits.dev">React Bits</a>.
        </p>
        <div className="footer-links">
          <a href="/projects/">Projects</a>
          <a href="/games/">Games</a>
          <a href={GITHUB_URL}>GitHub</a>
        </div>
      </div>
    </footer>
  );
}
