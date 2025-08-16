#!/usr/bin/env node
/*
  GitHub Activity Summarizer (Node 18+)
  -------------------------------------------
  • Default: groups by day, org/repo, counts activity types
  • With --detailed: shows full list of events, grouped by org/repo, day
  • With --include <types>: filter to only certain event types (comma-separated)

  Usage examples:
    node gh-summary.mjs --user mgifford --days 31
    node gh-summary.mjs --user mgifford --days 7 --detailed
    node gh-summary.mjs --user mgifford --include commit,issue,discussion
*/

function normalizeDashes(token) {
  return token.replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-');
}

function parseArgs(argv) {
  const args = {};
  const a = argv.map(normalizeDashes);
  for (let i = 0; i < a.length; i++) {
    const tok = a[i];
    if (tok.startsWith('--')) {
      const key = tok.slice(2);
      const next = a[i + 1];
      if (!next || next.startsWith('-')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

function showHelp() {
  console.log(`\nGitHub Activity Summarizer\n\nOptions:\n  --user <username>        GitHub username (required)\n  --days <n>               Number of days to look back (default: 31)\n  --timezone <tz>          Timezone, e.g. Europe/Paris (default: system tz)\n  --include-private        Include private events (requires GITHUB_TOKEN)\n  --detailed               Show detailed listing of all events\n  --include <types>        Comma-separated list of types to include (e.g. commit,issue,discussion)\n  --help                   Show this help screen\n`);
}

const rawArgs = process.argv.slice(2);
const args = parseArgs(rawArgs);

if (args.help || Object.keys(args).length === 0) {
  showHelp();
  process.exit(0);
}

const USER = String(args.user || '').trim();
const DAYS = Number(args.days || 31);
const TZ = String(args.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
const INCLUDE_PRIVATE = Boolean(args['include-private'] || false);
const DETAILED = Boolean(args['detailed'] || false);
const INCLUDE_TYPES = args['include'] ? String(args['include']).split(',').map(s => s.trim().toLowerCase()) : null;
const SINCE = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

if (!USER) {
  console.error('Error: --user <github-username> is required');
  showHelp();
  process.exit(1);
}

if (!globalThis.fetch) {
  console.error('Error: This script requires Node 18+ (global fetch).');
  process.exit(1);
}

const API = 'https://api.github.com';

function authHeaders() {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'gh-summary'
  };
  if (GITHUB_TOKEN) headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  return headers;
}

async function ghJson(url) {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status} for ${url}: ${text}`);
  }
  const link = res.headers.get('link') || '';
  const items = await res.json();
  return { items, link };
}

function parseLinkHeader(link) {
  return Object.fromEntries((link || '').split(',').map(s => s.trim()).filter(Boolean).map(part => {
    const m = part.match(/^<([^>]+)>;\s*rel="([^"]+)"/);
    return m ? [m[2], m[1]] : null;
  }).filter(Boolean));
}

async function fetchUserEvents(username, since, includePrivate) {
  const perPage = 100;
  let page = 1;
  let out = [];
  while (true) {
    const endpoint = includePrivate
      ? `${API}/users/${encodeURIComponent(username)}/events?per_page=${perPage}&page=${page}`
      : `${API}/users/${encodeURIComponent(username)}/events/public?per_page=${perPage}&page=${page}`;

    const { items, link } = await ghJson(endpoint);
    if (!Array.isArray(items) || items.length === 0) break;

    out.push(...items);
    const oldest = items[items.length - 1]?.created_at ? new Date(items[items.length - 1].created_at) : null;
    if (oldest && oldest < since) break;

    const rel = parseLinkHeader(link);
    if (!rel.next) break;
    page += 1;
    if (page > 20) break;
  }
  return out.filter(e => new Date(e.created_at) >= since);
}

function dfmt(dt, tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt);
}

function classifyEvent(e) {
  switch (e.type) {
    case 'PushEvent': return 'commit';
    case 'IssuesEvent': return 'issue';
    case 'IssueCommentEvent': return 'issue comment';
    case 'PullRequestEvent': return 'pull request';
    case 'PullRequestReviewEvent': return 'pr review';
    case 'PullRequestReviewCommentEvent': return 'pr review comment';
    case 'CommitCommentEvent': return 'commit comment';
    case 'DiscussionEvent': return 'discussion';
    case 'DiscussionCommentEvent': return 'discussion comment';
    case 'GollumEvent': return 'wiki';
    case 'CreateEvent': return 'create';
    case 'DeleteEvent': return 'delete';
    case 'ReleaseEvent': return 'release';
    default: return e.type.replace(/Event$/, '').toLowerCase();
  }
}

function summarize(events, tz) {
  const map = new Map();
  for (const e of events) {
    const type = classifyEvent(e);
    if (INCLUDE_TYPES && !INCLUDE_TYPES.includes(type)) continue;
    const d = dfmt(new Date(e.created_at), tz);
    if (!map.has(d)) map.set(d, {});
    const repo = e.repo?.name || 'unknown';
    const key = `${repo}::${type}`;
    map.get(d)[key] = (map.get(d)[key] || 0) + 1;
  }
  return map;
}

function detailed(events, tz) {
  const map = new Map();
  for (const e of events) {
    const type = classifyEvent(e);
    if (INCLUDE_TYPES && !INCLUDE_TYPES.includes(type)) continue;
    const d = dfmt(new Date(e.created_at), tz);
    if (!map.has(d)) map.set(d, new Map());
    const repo = e.repo?.name || 'unknown';
    if (!map.get(d).has(repo)) map.get(d).set(repo, []);
    let desc = type;
    if (type === 'commit') {
      const commits = e.payload?.commits || [];
      for (const c of commits) {
        map.get(d).get(repo).push(`commit: ${c.message?.split('\n')[0] || '(no message)'}`);
      }
      continue;
    }
    if (e.payload?.issue?.title) desc += `: ${e.payload.issue.title}`;
    if (e.payload?.pull_request?.title) desc += `: ${e.payload.pull_request.title}`;
    if (e.payload?.discussion?.title) desc += `: ${e.payload.discussion.title}`;
    map.get(d).get(repo).push(desc);
  }
  return map;
}

(async function main() {
  try {
    const events = await fetchUserEvents(USER, SINCE, INCLUDE_PRIVATE);

    if (DETAILED) {
      const grouped = detailed(events, TZ);
      for (const [date, repoMap] of [...grouped.entries()].sort((a,b)=> new Date(a[0]) - new Date(b[0]))) {
        console.log(date);
        for (const [repo, list] of [...repoMap.entries()].sort()) {
          for (const desc of list) {
            console.log(`  ${repo} ${desc}`);
          }
        }
        console.log('');
      }
    } else {
      const grouped = summarize(events, TZ);
      for (const [date, counts] of [...grouped.entries()].sort((a,b)=> new Date(a[0]) - new Date(b[0]))) {
        console.log(date);
        const sortedKeys = Object.keys(counts).sort();
        for (const key of sortedKeys) {
          const [repo, type] = key.split('::');
          console.log(`  ${counts[key]} ${repo} ${type}`);
        }
        console.log('');
      }
    }
  } catch (err) {
    console.error('Failed:', err?.message || err);
    process.exit(2);
  }
})();
