// Tiny markdown renderer for the blog posts. Supports what a post needs:
// # Headings, > blockquotes, - lists, paragraphs and inline **bold**,
// *italic*, `code` and [text](url). Each paragraph keeps its line breaks,
// so poems survive pasting as-is. Full-line <!-- comments --> are ignored.

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
            <li key={j}>{inline(item, `${key}-${j}`)}</li>
          ))}
        </ul>
      );
    }
    return <p key={key} className="blog-md-p">{inline(block.lines.join('\n'), key)}</p>;
  });
}
