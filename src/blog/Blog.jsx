import { motion } from 'motion/react';
import Footer from '../components/Footer';
import Markdown from './Markdown';
import { useLenis } from '../lib/useLenis';
import { withBase } from '../i18n';
import { GitHubIcon } from '../components/Icons';
import poemOfAi from './posts/a-poem-of-ai.md?raw';

const EASE = [0.22, 1, 0.36, 1];
const TITLE = 'blog';

// Posts, newest first. The body is markdown from src/blog/posts/<id>.md —
// write it there; the `// text here` placeholder shows until it has content.
const POSTS = [
  {
    id: 'a-poem-of-ai',
    title: 'A poem of AI',
    body: poemOfAi.replace(/^<!--[\s\S]*?-->\n?/gm, '').trim(),
  },
];

// No standalone language toggle: there is no /de/ version of this page yet,
// so this header mirrors the shared nav with just the working links.
function Header() {
  return (
    <header className="nav">
      <nav className="container nav-inner" aria-label="Main">
        <a className="nav-logo" href={withBase('/')}>
          <img src={withBase('/favicon.svg')} alt="" />
          Malte
        </a>
        <div className="nav-links">
          <a href={withBase('/projects/')}>Projects</a>
          <a href="https://github.com/malte9799" aria-label="GitHub">
            <GitHubIcon />
          </a>
        </div>
      </nav>
    </header>
  );
}

export default function Blog() {
  useLenis();
  return (
    <>
      <Header />
      <main>
        <header className="blog-hero container">
          <h1 className="blog-title" aria-label={TITLE}>
            {[...TITLE].map((letter, i) => (
              <span key={i} aria-hidden="true" className="blog-letter" style={{ '--i': i }}>
                {letter}
              </span>
            ))}
          </h1>
          <motion.p
            className="blog-hint"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
          >
            Hover me.
          </motion.p>
        </header>

        <section className="blog-posts container">
          {POSTS.map((post, i) => (
            <motion.article
              key={post.id}
              className="blog-post"
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10% 0px' }}
              transition={{ duration: 0.8, delay: 0.1 + i * 0.1, ease: EASE }}
            >
              <h2 className="blog-post-title">{post.title}</h2>
              {post.body ? (
                <div className="blog-post-body">
                  <Markdown text={post.body} />
                </div>
              ) : (
                <p className="blog-post-todo">// text here</p>
              )}
            </motion.article>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
