/**
 * Tests for gh-org-summary.mjs utility functions:
 *   normalizeDashes (org version), parseArgs, cleanOrgName, parseLinkHeader
 */

import { describe, it } from 'node:test';
import { strictEqual, deepStrictEqual, ok } from 'node:assert';

// ── Inline definitions ───────────────────────────────────────────────────────
// Copied verbatim from gh-org-summary.mjs to allow isolated unit testing
// without triggering module-level side-effects.

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

const cleanOrgName = (orgName) => {
  let name = orgName
    .replace(/^https?:\/\/[^/]+\//, '')
    .replace(/^orgs\//, '')
    .replace(/\/$/, '');

  name = name.split('/').filter(Boolean)[0] || name;

  if (name.toLowerCase() === 'usds') {
    name = 'usds';
  }

  return {
    original: name,
    lower: name.toLowerCase(),
  };
};

function parseLinkHeader(link) {
  return Object.fromEntries(
    (link || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(part => {
        const m = part.match(/^<([^>]+)>;\s*rel="([^"]+)"/);
        return m ? [m[2], m[1]] : null;
      })
      .filter(Boolean)
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('normalizeDashes (org version)', () => {
  it('returns plain ASCII strings unchanged', () => {
    strictEqual(normalizeDashes('--org'), '--org');
    strictEqual(normalizeDashes('hello-world'), 'hello-world');
    strictEqual(normalizeDashes(''), '');
  });

  it('replaces en-dash (U+2013) with hyphen-minus', () => {
    strictEqual(normalizeDashes('\u2013org'), '-org');
  });

  it('replaces em-dash (U+2014) with hyphen-minus', () => {
    strictEqual(normalizeDashes('\u2014\u2014org'), '--org');
  });

  it('replaces minus sign (U+2212) with hyphen-minus', () => {
    strictEqual(normalizeDashes('\u2212\u2212days'), '--days');
  });

  it('replaces fullwidth hyphen-minus (U+FF0D) with hyphen-minus', () => {
    strictEqual(normalizeDashes('\uff0d\uff0dorg'), '--org');
  });

  it('replaces small em dash (U+FE58) with hyphen-minus', () => {
    strictEqual(normalizeDashes('\ufe58x'), '-x');
  });

  it('replaces small hyphen-minus (U+FE63) with hyphen-minus', () => {
    strictEqual(normalizeDashes('\ufe63y'), '-y');
  });

  it('does NOT replace ordinary digits or letters', () => {
    strictEqual(normalizeDashes('abc83D'), 'abc83D');
  });
});

describe('cleanOrgName', () => {
  it('returns a simple org name unchanged', () => {
    const result = cleanOrgName('civicactions');
    strictEqual(result.original, 'civicactions');
    strictEqual(result.lower, 'civicactions');
  });

  it('strips https:// protocol and domain', () => {
    const result = cleanOrgName('https://github.com/civicactions');
    strictEqual(result.original, 'civicactions');
    strictEqual(result.lower, 'civicactions');
  });

  it('strips http:// protocol and domain', () => {
    const result = cleanOrgName('http://github.com/MyOrg');
    strictEqual(result.original, 'MyOrg');
    strictEqual(result.lower, 'myorg');
  });

  it('strips trailing slash', () => {
    const result = cleanOrgName('civicactions/');
    strictEqual(result.original, 'civicactions');
  });

  it('strips orgs/ prefix', () => {
    const result = cleanOrgName('orgs/civicactions');
    strictEqual(result.original, 'civicactions');
  });

  it('handles full GitHub URL with orgs/ in path', () => {
    const result = cleanOrgName('https://github.com/orgs/civicactions');
    strictEqual(result.original, 'civicactions');
  });

  it('preserves original case in the original field', () => {
    const result = cleanOrgName('CivicActions');
    strictEqual(result.original, 'CivicActions');
    strictEqual(result.lower, 'civicactions');
  });

  it('lowercases the lower field regardless of input case', () => {
    const result = cleanOrgName('MyOrg');
    strictEqual(result.lower, 'myorg');
  });

  it('handles USDS org name specially (preserves lowercase)', () => {
    const result = cleanOrgName('USDS');
    strictEqual(result.original, 'usds');
    strictEqual(result.lower, 'usds');
  });

  it('handles usds (already lowercase) correctly', () => {
    const result = cleanOrgName('usds');
    strictEqual(result.original, 'usds');
    strictEqual(result.lower, 'usds');
  });

  it('takes only the first path segment after stripping URL parts', () => {
    const result = cleanOrgName('https://github.com/civicactions/some-repo');
    strictEqual(result.original, 'civicactions');
  });
});

describe('parseArgs (org version)', () => {
  it('returns empty object for empty argv', () => {
    deepStrictEqual(parseArgs([]), {});
  });

  it('parses --org value', () => {
    deepStrictEqual(parseArgs(['--org', 'civicactions']), { org: 'civicactions' });
  });

  it('parses --days value', () => {
    deepStrictEqual(parseArgs(['--days', '14']), { days: '14' });
  });

  it('parses --detailed as a boolean flag', () => {
    deepStrictEqual(parseArgs(['--org', 'myorg', '--detailed']), {
      org: 'myorg',
      detailed: true,
    });
  });

  it('parses multiple flags and values', () => {
    deepStrictEqual(
      parseArgs(['--org', 'myorg', '--days', '7', '--include', 'commit,issue']),
      { org: 'myorg', days: '7', include: 'commit,issue' }
    );
  });

  it('normalizes unicode dashes in arg names', () => {
    const result = parseArgs(['\u2014\u2014org', 'myorg']);
    deepStrictEqual(result, { org: 'myorg' });
  });
});

describe('parseLinkHeader (org version)', () => {
  it('returns empty object for empty string', () => {
    deepStrictEqual(parseLinkHeader(''), {});
  });

  it('parses rel="next"', () => {
    const header = '<https://api.github.com/orgs/myorg/members?page=2>; rel="next"';
    deepStrictEqual(parseLinkHeader(header), {
      next: 'https://api.github.com/orgs/myorg/members?page=2',
    });
  });

  it('parses multiple relations', () => {
    const header =
      '<https://api.github.com/orgs/myorg/members?page=1>; rel="prev", ' +
      '<https://api.github.com/orgs/myorg/members?page=3>; rel="next"';
    deepStrictEqual(parseLinkHeader(header), {
      prev: 'https://api.github.com/orgs/myorg/members?page=1',
      next: 'https://api.github.com/orgs/myorg/members?page=3',
    });
  });
});

// ── Org-version summarize and detailed ──────────────────────────────────────
// The org summary functions differ from the user summary functions in that they
// use `https://github.com/<repo>` as the map key rather than the raw repo name.
// Copied verbatim from gh-org-summary.mjs with INCLUDE_TYPES parameterised.

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

function dfmt(dt, tz) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dt);
}

function summarizeOrg(events, tz, includeTypes = null) {
  const map = new Map();
  for (const e of events) {
    const type = classifyEvent(e);
    if (includeTypes && !includeTypes.includes(type)) continue;
    const d = dfmt(new Date(e.created_at), tz);
    if (!map.has(d)) map.set(d, {});
    const repo = e.repo?.name || 'unknown';
    const repoUrl = `https://github.com/${repo}`;
    const key = `${repoUrl}::${type}`;
    map.get(d)[key] = (map.get(d)[key] || 0) + 1;
  }
  return map;
}

function detailedOrg(events, tz, includeTypes = null) {
  const map = new Map();
  for (const e of events) {
    const type = classifyEvent(e);
    if (includeTypes && !includeTypes.includes(type)) continue;
    const d = dfmt(new Date(e.created_at), tz);
    if (!map.has(d)) map.set(d, new Map());
    const repo = e.repo?.name || 'unknown';
    const repoUrl = `https://github.com/${repo}`;
    if (!map.get(d).has(repoUrl)) map.get(d).set(repoUrl, []);

    let desc = type;
    if (type === 'commit') {
      const commits = e.payload?.commits || [];
      for (const c of commits) {
        const commitUrl = c.url ? `\n    ${c.url}` : '';
        map.get(d).get(repoUrl).push(`commit: ${c.message?.split('\n')[0] || '(no message)'}${commitUrl}`);
      }
      continue;
    }

    let itemUrl = '';
    if (e.payload?.issue) {
      itemUrl = `\n    ${e.payload.issue.html_url || ''}`;
      desc += `: ${e.payload.issue.title}`;
    }
    if (e.payload?.pull_request) {
      itemUrl = `\n    ${e.payload.pull_request.html_url || ''}`;
      desc += `: ${e.payload.pull_request.title}`;
    }
    if (e.payload?.discussion) {
      itemUrl = `\n    ${e.payload.discussion.html_url || ''}`;
      desc += `: ${e.payload.discussion.title}`;
    }

    map.get(d).get(repoUrl).push(`${desc}${itemUrl}`);
  }
  return map;
}

describe('summarize (org version)', () => {
  const tz = 'UTC';

  it('returns an empty map for empty events array', () => {
    strictEqual(summarizeOrg([], tz).size, 0);
  });

  it('uses full GitHub URL as map key instead of bare repo name', () => {
    const events = [
      {
        type: 'PushEvent',
        created_at: '2024-03-15T10:00:00Z',
        repo: { name: 'myorg/my-repo' },
      },
    ];
    const result = summarizeOrg(events, tz);
    const counts = [...result.values()][0];
    // Key must use the full URL, not just the repo name
    ok(Object.keys(counts).some(k => k.startsWith('https://github.com/myorg/my-repo')),
      'key should start with https://github.com/myorg/my-repo');
    strictEqual(counts['https://github.com/myorg/my-repo::commit'], 1);
  });

  it('aggregates multiple events of the same type on the same day', () => {
    const events = [
      { type: 'PushEvent', created_at: '2024-03-15T08:00:00Z', repo: { name: 'org/repo' } },
      { type: 'PushEvent', created_at: '2024-03-15T09:00:00Z', repo: { name: 'org/repo' } },
    ];
    const result = summarizeOrg(events, tz);
    const counts = [...result.values()][0];
    strictEqual(counts['https://github.com/org/repo::commit'], 2);
  });

  it('separates events from different repos on the same day', () => {
    const events = [
      { type: 'PushEvent', created_at: '2024-03-15T08:00:00Z', repo: { name: 'org/repo-a' } },
      { type: 'PushEvent', created_at: '2024-03-15T09:00:00Z', repo: { name: 'org/repo-b' } },
    ];
    const result = summarizeOrg(events, tz);
    const counts = [...result.values()][0];
    strictEqual(counts['https://github.com/org/repo-a::commit'], 1);
    strictEqual(counts['https://github.com/org/repo-b::commit'], 1);
  });

  it('separates events from different days', () => {
    const events = [
      { type: 'PushEvent', created_at: '2024-03-15T08:00:00Z', repo: { name: 'org/repo' } },
      { type: 'PushEvent', created_at: '2024-03-16T08:00:00Z', repo: { name: 'org/repo' } },
    ];
    strictEqual(summarizeOrg(events, tz).size, 2);
  });

  it('uses "unknown" key segment when event has no repo', () => {
    const events = [{ type: 'PushEvent', created_at: '2024-03-15T08:00:00Z' }];
    const result = summarizeOrg(events, tz);
    const counts = [...result.values()][0];
    strictEqual(counts['https://github.com/unknown::commit'], 1);
  });

  it('filters events when includeTypes is provided', () => {
    const events = [
      { type: 'PushEvent', created_at: '2024-03-15T08:00:00Z', repo: { name: 'org/repo' } },
      { type: 'IssuesEvent', created_at: '2024-03-15T09:00:00Z', repo: { name: 'org/repo' } },
    ];
    const result = summarizeOrg(events, tz, ['commit']);
    const counts = [...result.values()][0];
    strictEqual(counts['https://github.com/org/repo::commit'], 1);
    strictEqual(counts['https://github.com/org/repo::issue'], undefined);
  });
});

describe('detailed (org version)', () => {
  const tz = 'UTC';

  it('returns an empty map for empty events array', () => {
    strictEqual(detailedOrg([], tz).size, 0);
  });

  it('uses full GitHub URL as repo key', () => {
    const events = [
      {
        type: 'IssuesEvent',
        created_at: '2024-03-15T08:00:00Z',
        repo: { name: 'org/repo' },
        payload: { issue: { title: 'A bug', html_url: 'https://github.com/org/repo/issues/1' } },
      },
    ];
    const result = detailedOrg(events, tz);
    const dayMap = [...result.values()][0];
    ok(dayMap.has('https://github.com/org/repo'), 'repo key should be the full URL');
  });

  it('groups commit messages by full repo URL key', () => {
    const events = [
      {
        type: 'PushEvent',
        created_at: '2024-03-15T08:00:00Z',
        repo: { name: 'org/repo' },
        payload: { commits: [{ message: 'Fix bug\nDetails' }, { message: 'Add feature' }] },
      },
    ];
    const result = detailedOrg(events, tz);
    const dayMap = [...result.values()][0];
    const entries = dayMap.get('https://github.com/org/repo');
    ok(Array.isArray(entries));
    strictEqual(entries.length, 2);
    strictEqual(entries[0], 'commit: Fix bug');
    strictEqual(entries[1], 'commit: Add feature');
  });

  it('appends issue title and URL to issue event description', () => {
    const events = [
      {
        type: 'IssuesEvent',
        created_at: '2024-03-15T08:00:00Z',
        repo: { name: 'org/repo' },
        payload: {
          issue: { title: 'Crash on startup', html_url: 'https://github.com/org/repo/issues/5' },
        },
      },
    ];
    const result = detailedOrg(events, tz);
    const entries = [...result.values()][0].get('https://github.com/org/repo');
    ok(entries[0].includes('Crash on startup'));
    ok(entries[0].includes('https://github.com/org/repo/issues/5'));
  });

  it('appends PR title and URL to pull request event description', () => {
    const events = [
      {
        type: 'PullRequestEvent',
        created_at: '2024-03-15T08:00:00Z',
        repo: { name: 'org/repo' },
        payload: {
          pull_request: { title: 'New feature', html_url: 'https://github.com/org/repo/pull/10' },
        },
      },
    ];
    const result = detailedOrg(events, tz);
    const entries = [...result.values()][0].get('https://github.com/org/repo');
    ok(entries[0].includes('New feature'));
    ok(entries[0].includes('https://github.com/org/repo/pull/10'));
  });

  it('appends discussion title and URL to discussion event description', () => {
    const events = [
      {
        type: 'DiscussionEvent',
        created_at: '2024-03-15T08:00:00Z',
        repo: { name: 'org/repo' },
        payload: {
          discussion: { title: 'Roadmap?', html_url: 'https://github.com/org/repo/discussions/2' },
        },
      },
    ];
    const result = detailedOrg(events, tz);
    const entries = [...result.values()][0].get('https://github.com/org/repo');
    ok(entries[0].includes('Roadmap?'));
    ok(entries[0].includes('https://github.com/org/repo/discussions/2'));
  });

  it('appends commit URL when present on the commit object', () => {
    const events = [
      {
        type: 'PushEvent',
        created_at: '2024-03-15T08:00:00Z',
        repo: { name: 'org/repo' },
        payload: {
          commits: [{ message: 'Add tests', url: 'https://api.github.com/repos/org/repo/commits/abc' }],
        },
      },
    ];
    const result = detailedOrg(events, tz);
    const entries = [...result.values()][0].get('https://github.com/org/repo');
    ok(entries[0].includes('Add tests'));
    ok(entries[0].includes('https://api.github.com/repos/org/repo/commits/abc'));
  });

  it('filters events when includeTypes is provided', () => {
    const events = [
      {
        type: 'PushEvent',
        created_at: '2024-03-15T08:00:00Z',
        repo: { name: 'org/repo' },
        payload: { commits: [{ message: 'Fix' }] },
      },
      {
        type: 'IssuesEvent',
        created_at: '2024-03-15T09:00:00Z',
        repo: { name: 'org/repo' },
        payload: { issue: { title: 'Bug', html_url: '' } },
      },
    ];
    const result = detailedOrg(events, tz, ['commit']);
    const dayMap = [...result.values()][0];
    const entries = dayMap.get('https://github.com/org/repo');
    strictEqual(entries.length, 1);
    strictEqual(entries[0], 'commit: Fix');
  });

  it('uses "unknown" key when event has no repo', () => {
    const events = [
      {
        type: 'IssuesEvent',
        created_at: '2024-03-15T08:00:00Z',
        payload: { issue: { title: 'Orphan', html_url: '' } },
      },
    ];
    const result = detailedOrg(events, tz);
    const dayMap = [...result.values()][0];
    ok(dayMap.has('https://github.com/unknown'));
  });
});
