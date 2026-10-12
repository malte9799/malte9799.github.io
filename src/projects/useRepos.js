import { useEffect, useState } from 'react';
import { GITHUB_USER, HIDDEN_REPOS } from '../data/projects';

const CACHE_KEY = `repos:${GITHUB_USER}`;
const CACHE_MS = 30 * 60 * 1000;

const readCache = () => {
  try {
    const hit = JSON.parse(sessionStorage.getItem(CACHE_KEY));
    return hit && Date.now() - hit.at < CACHE_MS ? hit.repos : null;
  } catch {
    return null;
  }
};

const writeCache = repos => {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), repos }));
  } catch {
    // Storage can be unavailable (private mode); the list just refetches.
  }
};

// The user's own public repos (no forks or archives), most recently pushed first.
// Unauthenticated GitHub API: 60 requests/hour per visitor, so the result is
// cached for the session.
export function useRepos() {
  const [state, setState] = useState(() => {
    const cached = readCache();
    return cached ? { status: 'ready', repos: cached } : { status: 'loading', repos: [] };
  });

  useEffect(() => {
    if (state.status === 'ready') return undefined;
    const controller = new AbortController();

    fetch(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=pushed`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    })
      .then(res => {
        if (!res.ok) throw new Error(`GitHub API ${res.status}`);
        return res.json();
      })
      .then(data => {
        const repos = data
          .filter(r => !r.fork && !r.archived && !HIDDEN_REPOS.has(r.name))
          .map(r => ({
            name: r.name,
            url: r.html_url,
            homepage: r.homepage || null,
            description: r.description,
            language: r.language,
            stars: r.stargazers_count,
            pushedAt: r.pushed_at,
          }));
        writeCache(repos);
        setState({ status: 'ready', repos });
      })
      .catch(err => {
        if (err.name !== 'AbortError') setState({ status: 'error', repos: [] });
      });

    return () => controller.abort();
  }, [state.status]);

  return state;
}
