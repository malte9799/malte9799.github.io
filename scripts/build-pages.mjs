// Builds the whole GitHub Pages site into ./site:
//   /                 the main branch (production)
//   /previews/<slug>/ every other branch, newest first (max MAX_PREVIEWS)
//   /previews/        an index listing the previews
// Run by .github/workflows/deploy.yml; also works locally:
//   node scripts/build-pages.mjs        (needs `git fetch` of the remote branches first)
// A branch that fails to build is skipped and never blocks the deploy.

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = join(root, 'site');
const work = join(root, '.pages-work');
const MAX_PREVIEWS = Number(process.env.MAX_PREVIEWS || 12);
const MAIN = process.env.MAIN_BRANCH || 'main';
const REMOTE = process.env.REMOTE || 'origin';

const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });
const read = (cmd, args) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8' }).trim();

const slugOf = branch => branch.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'branch';

// Build one branch into `dest`. `base` is '/' for main, '/previews/<slug>/' otherwise.
function build(branch, dest, base) {
  const dir = join(work, slugOf(branch));
  run('git', ['worktree', 'add', '--force', '--detach', dir, `${REMOTE}/${branch}`]);
  if (!existsSync(join(dir, 'package.json'))) throw new Error('no package.json');
  run('npm', ['ci', '--no-audit', '--no-fund', '--prefer-offline'], dir);
  run('npx', ['vite', 'build', '--base', base], dir);
  cpSync(join(dir, 'dist'), dest, { recursive: true });
}

// The React pages take the base from `vite build --base`. The hand-written HTML
// (games/, old/, the noscript fallbacks) still links with root-absolute paths, so
// point those into the preview. Also drop the German auto-redirect (it would build
// wrong URLs) and tell robots to stay away.
function retarget(dir, prefix) {
  for (const name of readdirSync(dir, { recursive: true })) {
    if (!name.endsWith('.html')) continue;
    const file = join(dir, name);
    if (!statSync(file).isFile()) continue;
    let s = readFileSync(file, 'utf8');
    s = s.replace(/<script>\s*\/\/ Send German-speaking visitors[\s\S]*?<\/script>/, '');
    s = s.replace('<head>', '<head>\n<meta name="robots" content="noindex" />');
    s = s.replace(/\b(href|src)=(["'])\/(?=(?:games|de|projects|old|img|favicon\.svg)\b|\2)/g, `$1=$2${prefix}`);
    writeFileSync(file, s);
  }
}

rmSync(out, { recursive: true, force: true });
rmSync(work, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

build(MAIN, out, '/');

const branches = read('git', ['for-each-ref', '--sort=-committerdate', '--format=%(refname:strip=3)', `refs/remotes/${REMOTE}`])
  .split('\n')
  .filter(b => b && b !== 'HEAD' && b !== MAIN)
  .slice(0, MAX_PREVIEWS);

const built = [];
for (const branch of branches) {
  const slug = slugOf(branch);
  const dest = join(out, 'previews', slug);
  try {
    build(branch, dest, `/previews/${slug}/`);
    retarget(dest, `/previews/${slug}/`);
    built.push({ branch, slug });
  } catch (err) {
    console.warn(`::warning::preview for "${branch}" skipped: ${err.message}`);
    rmSync(dest, { recursive: true, force: true });
  }
}

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
mkdirSync(join(out, 'previews'), { recursive: true });
writeFileSync(
  join(out, 'previews', 'index.html'),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Branch previews</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 20px;background:#0b0b0d;color:#eee}
a{color:#9ecbff}li{margin:6px 0}small{color:#888}</style>
<h1>Branch previews</h1>
${built.length ? '<ul>' + built.map(b => `<li><a href="${b.slug}/">${esc(b.branch)}</a> · <a href="${b.slug}/games/"><small>games</small></a></li>`).join('') + '</ul>' : '<p>No open branches.</p>'}
<p><a href="/">← production</a></p></html>`,
);
writeFileSync(join(out, '.nojekyll'), '');

run('git', ['worktree', 'prune']);
rmSync(work, { recursive: true, force: true });
console.log(`built ${MAIN} + ${built.length} preview(s): ${built.map(b => b.slug).join(', ') || '-'}`);
