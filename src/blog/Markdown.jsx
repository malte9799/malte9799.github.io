// Tiny markdown renderer for the blog posts. Supports what a post needs:
// # Headings, > blockquotes, - lists, paragraphs and inline **bold**,
// *italic*, `code` and [text](url). Each paragraph keeps its line breaks,
// so poems survive pasting as-is. Full-line <!-- comments --> are ignored.
//
// Annotation syntax:
//   ==passage==     -> a clickable highlight (cursor hints at clicking)
//   ==passage==%%description%%          -> the highlight reveals its description on click
//   a paragraph that is only %%description%% -> a visible aside (standalone note)

import { useState } from 'react';

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function inline(text, keyPrefix) {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={key}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={key}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) return <a key={key} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    return part;
  });
}

// A highlighted passage; clicking toggles its %%description%%.
function Highlight({ text, note, keyPrefix }) {
  const [open, setOpen] = useState(false);
  if (!note) {
    return <mark key={keyPrefix} className="blog-md-mark">{inline(text, keyPrefix)}</mark>;
  }
  const noteKey = `${keyPrefix}-note`;
  return (
    <span key={keyPrefix} className={`blog-md-hl${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className={`blog-md-mark is-button${open ? ' is-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        {inline(text, `${keyPrefix}-t`)}
      </button>
      <span className={`blog-md-note${open ? ' is-open' : ''}`} role="note">
        {inline(note, noteKey)}
      </span>
    </span>
  );
}

function withHl(text, keyPrefix) {
  // Split into plain / highlight segments, matching an optional trailing
  // %%description%% directly after each ==passage==.
  const out = [];
  const pushPlain = chunk => {
    if (!chunk) return;
    const key = `${keyPrefix}-s${out.length}`;
    out.push(inline(chunk, key));
  };
  let rest = String(text);
  for (;;) {
    const m = rest.match(/==([\s\S]+?)==/);
    if (!m) break;
    pushPlain(rest.slice(0, m.index));
    const key = `${keyPrefix}-s${out.length}`;
    const tail = rest.slice(m.index + m[0].length);
    const note = tail.match(/^(?:\s*%%([\s\S]+?)%%)/);
    const noteText = note ? note[1] : '';
    out.push(<Highlight key={key} text={m[1]} note={noteText} keyPrefix={`${key}-h`} />);
    rest = note ? tail.slice(note[0].length) : tail;
  }
  pushPlain(rest);
  return out;
}

export default function Markdown({ text }) {
  const lines = text
    .split('\n')
    .map(line => (line.trim().startsWith('<!--') && line.trim().endsWith('-->') ? '' : line));

  const blocks = [];
  let para = [];
  let quote = [];
  let list = [];
  let code = null; // collecting lines inside a ``` fence
  const flush = () => {
    if (para.length) blocks.push({ kind: 'p', lines: para });
    if (quote.length) blocks.push({ kind: 'blockquote', lines: quote });
    if (list.length) blocks.push({ kind: 'ul', items: list });
    para = [];
    quote = [];
    list = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      if (code) {
        blocks.push({ kind: 'pre', text: code.join('\n') });
        code = null;
      } else {
        flush();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    if (!trimmed) {
      flush();
      continue;
    }
    if (trimmed.startsWith('#')) {
      flush();
      blocks.push({ kind: 'h', level: trimmed.match(/^#+/)[0].length, text: trimmed.replace(/^#+\s*/, '') });
    } else if (trimmed.startsWith('> ')) {      if (para.length || list.length) flush();
      quote.push(trimmed.slice(2));
    } else if (trimmed.startsWith('- ')) {
      if (para.length || quote.length) flush();
      list.push(trimmed.slice(2));
    } else {
      if (quote.length || list.length) flush();
      para.push(line);
    }
  }
  if (code && code.join('').trim()) blocks.push({ kind: 'pre', text: code.join('\n').replace(/^\n+|\s+$/g, '') }); // unterminated fence
  flush();

  return blocks.map((block, i) => {
    const key = `b${i}`;
    if (block.kind === 'pre') {
      return <pre key={key} className="blog-md-pre">{block.text}</pre>;
    }
    if (block.kind === 'h') {
      const Tag = `h${Math.min(block.level + 1, 6)}`; // post title is the h2
      return <Tag key={key} className={`blog-md-h blog-md-h${block.level}`}>{inline(block.text, key)}</Tag>;
    }
    if (block.kind === 'blockquote') {
      return <blockquote key={key} className="blog-md-quote">{inline(block.lines.join('\n'), key)}</blockquote>;
    }
    if (block.kind === 'ul') {
      return (
        <ul key={key} className="blog-md-list">
          {block.items.map((item, j) => (
            <li key={j}>{withHl(item, `${key}-${j}`)}</li>
          ))}
        </ul>
      );
    }
    // A paragraph that is nothing but %%text%% renders as a visible aside
    // (e.g. for notes that belong to a code block rather than a passage).
    if (block.lines.length === 1) {
      const solo = block.lines[0].trim().match(/^%%([\s\S]+)%%$/);
      if (solo) return <aside key={key} className="blog-md-aside">{inline(solo[1], `${key}-a`)}</aside>;
    }
    return <p key={key} className="blog-md-p">{withHl(block.lines.join('\n'), key)}</p>;
  });
}
