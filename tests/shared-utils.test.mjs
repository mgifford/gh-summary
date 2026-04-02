/**
 * Tests for shared utility functions used across gh-summary.mjs,
 * gh-org-summary.mjs, generate-data.mjs, and generate-usage.mjs.
 *
 * Functions tested:
 *   normalizeDashes, parseArgs, parseLinkHeader, classifyEvent, dfmt,
 *   summarize, detailed
 */

import { describe, it } from 'node:test';
import { strictEqual, deepStrictEqual, ok } from 'node:assert';

// ── Inline definitions of the pure utility functions ────────────────────────
// These are copied verbatim from gh-summary.mjs so they can be tested in
// isolation without triggering the module-level side effects (parseArgs,
// process.exit) in the original files.

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

// Testable version of summarize that accepts includeTypes as a parameter
// (matches the production version when includeTypes is null).
function summarize(events, tz, includeTypes = null) {
  const map = new Map();
  for (const e of events) {
    const type = classifyEvent(e);
    if (includeTypes && !includeTypes.includes(type)) continue;
    const d = dfmt(new Date(e.created_at), tz);
    if (!map.has(d)) map.set(d, {});
    const repo = e.repo?.name || 'unknown';
    const key = `${repo}::${type}`;
    map.get(d)[key] = (map.get(d)[key] || 0) + 1;
  }
  return map;
}

// Testable version of detailed that accepts includeTypes as a parameter.
function detailed(events, tz, includeTypes = null) {
  const map = new Map();
  for (const e of events) {
    const type = classifyEvent(e);
    if (includeTypes && !includeTypes.includes(type)) continue;
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('normalizeDashes', () => {
  it('returns plain ASCII strings unchanged', () => {
    strictEqual(normalizeDashes('--user'), '--user');
    strictEqual(normalizeDashes('hello-world'), 'hello-world');
    strictEqual(normalizeDashes(''), '');
  });

  it('replaces en-dash (U+2013) with hyphen-minus', () => {
    strictEqual(normalizeDashes('\u2013user'), '-user');
  });

  it('replaces em-dash (U+2014) with hyphen-minus', () => {
    strictEqual(normalizeDashes('\u2014\u2014user'), '--user');
  });

  it('replaces hyphen (U+2010) with hyphen-minus', () => {
    strictEqual(normalizeDashes('\u2010foo'), '-foo');
  });

  it('replaces minus sign (U+2212) with hyphen-minus', () => {
    strictEqual(normalizeDashes('\u2212\u2212days'), '--days');
  });

  it('replaces fullwidth hyphen-minus (U+FF0D) with hyphen-minus', () => {
    strictEqual(normalizeDashes('\uFF0D\uFF0Dorg'), '--org');
  });

  it('replaces small em dash (U+FE58) with hyphen-minus', () => {
    strictEqual(normalizeDashes('\uFE58x'), '-x');
  });

  it('handles mixed unicode and ASCII dashes', () => {
    strictEqual(normalizeDashes('\u2014-\u2013'), '---');
  });

  it('preserves digits and regular text', () => {
    strictEqual(normalizeDashes('abc123'), 'abc123');
  });
});

describe('parseArgs', () => {
  it('returns empty object for empty argv', () => {
    deepStrictEqual(parseArgs([]), {});
  });

  it('parses a flag without a value as boolean true', () => {
    deepStrictEqual(parseArgs(['--help']), { help: true });
  });

  it('parses a key-value pair', () => {
    deepStrictEqual(parseArgs(['--user', 'mgifford']), { user: 'mgifford' });
  });

  it('parses multiple key-value pairs', () => {
    deepStrictEqual(
      parseArgs(['--user', 'alice', '--days', '7']),
      { user: 'alice', days: '7' }
    );
  });

  it('treats arg starting with - as a flag boundary (no value)', () => {
    // --detailed followed by --user means detailed is a flag
    deepStrictEqual(
      parseArgs(['--detailed', '--user', 'bob']),
      { detailed: true, user: 'bob' }
    );
  });

  it('parses flag at end of argv as boolean true', () => {
    deepStrictEqual(parseArgs(['--user', 'carol', '--detailed']), {
      user: 'carol',
      detailed: true,
    });
  });

  it('parses --include with comma-separated value', () => {
    deepStrictEqual(parseArgs(['--include', 'commit,issue']), {
      include: 'commit,issue',
    });
  });

  it('normalizes unicode dashes in argument names', () => {
    // em-dash before a key should be normalized to --
    const args = parseArgs(['\u2014\u2014user', 'dave']);
    deepStrictEqual(args, { user: 'dave' });
  });

  it('ignores tokens that do not start with --', () => {
    deepStrictEqual(parseArgs(['positional', '--flag']), { flag: true });
  });
});

describe('parseLinkHeader', () => {
  it('returns empty object for empty string', () => {
    deepStrictEqual(parseLinkHeader(''), {});
  });

  it('returns empty object for null/undefined', () => {
    deepStrictEqual(parseLinkHeader(null), {});
    deepStrictEqual(parseLinkHeader(undefined), {});
  });

  it('parses a single rel="next" link', () => {
    const header =
      '<https://api.github.com/users/alice/events?page=2>; rel="next"';
    deepStrictEqual(parseLinkHeader(header), {
      next: 'https://api.github.com/users/alice/events?page=2',
    });
  });

  it('parses rel="prev" and rel="next" links', () => {
    const header =
      '<https://api.github.com/users/alice/events?page=1>; rel="prev", ' +
      '<https://api.github.com/users/alice/events?page=3>; rel="next"';
    deepStrictEqual(parseLinkHeader(header), {
      prev: 'https://api.github.com/users/alice/events?page=1',
      next: 'https://api.github.com/users/alice/events?page=3',
    });
  });

  it('parses rel="last" link', () => {
    const header =
      '<https://api.github.com/users/alice/events?page=10>; rel="last"';
    deepStrictEqual(parseLinkHeader(header), {
      last: 'https://api.github.com/users/alice/events?page=10',
    });
  });

  it('ignores malformed parts', () => {
    const header = 'not-a-link-header, <https://example.com>; rel="next"';
    deepStrictEqual(parseLinkHeader(header), {
      next: 'https://example.com',
    });
  });

  it('handles extra whitespace around commas', () => {
    const header =
      ' <https://api.github.com/p=2>; rel="next" , <https://api.github.com/p=1>; rel="prev" ';
    const result = parseLinkHeader(header);
    strictEqual(result.next, 'https://api.github.com/p=2');
    strictEqual(result.prev, 'https://api.github.com/p=1');
  });
});

describe('classifyEvent', () => {
  const cases = [
    ['PushEvent', 'commit'],
    ['IssuesEvent', 'issue'],
    ['IssueCommentEvent', 'issue comment'],
    ['PullRequestEvent', 'pull request'],
    ['PullRequestReviewEvent', 'pr review'],
    ['PullRequestReviewCommentEvent', 'pr review comment'],
    ['CommitCommentEvent', 'commit comment'],
    ['DiscussionEvent', 'discussion'],
    ['DiscussionCommentEvent', 'discussion comment'],
    ['GollumEvent', 'wiki'],
    ['CreateEvent', 'create'],
    ['DeleteEvent', 'delete'],
    ['ReleaseEvent', 'release'],
  ];

  for (const [type, expected] of cases) {
    it(`classifies ${type} as "${expected}"`, () => {
      strictEqual(classifyEvent({ type }), expected);
    });
  }

  it('handles unknown event types by stripping "Event" suffix and lowercasing', () => {
    strictEqual(classifyEvent({ type: 'ForkEvent' }), 'fork');
    strictEqual(classifyEvent({ type: 'WatchEvent' }), 'watch');
    strictEqual(classifyEvent({ type: 'PublicEvent' }), 'public');
    strictEqual(classifyEvent({ type: 'SponsorshipEvent' }), 'sponsorship');
  });
});

describe('dfmt', () => {
  it('formats a date in UTC', () => {
    // 2024-03-15 UTC
    const dt = new Date('2024-03-15T12:00:00Z');
    const result = dfmt(dt, 'UTC');
    ok(result.includes('2024'), 'should contain year');
    ok(result.includes('03'), 'should contain month');
    ok(result.includes('15'), 'should contain day');
  });

  it('includes the day of week', () => {
    // 2024-01-01 was a Monday
    const dt = new Date('2024-01-01T12:00:00Z');
    const result = dfmt(dt, 'UTC');
    ok(result.toLowerCase().includes('monday'), 'should include weekday name');
  });

  it('respects timezone offset', () => {
    // 2024-06-15T00:30:00Z is still June 14 in America/New_York (UTC-4)
    const dt = new Date('2024-06-15T03:30:00Z');
    const nyResult = dfmt(dt, 'America/New_York');
    const utcResult = dfmt(dt, 'UTC');
    // In UTC this is June 15; in New_York (UTC-4) it's still June 14
    ok(utcResult.includes('15'), 'UTC result should be day 15');
    ok(nyResult.includes('14'), 'New_York result should be day 14');
  });
});

describe('summarize', () => {
  const tz = 'UTC';

  it('returns an empty map for empty events array', () => {
    const result = summarize([], tz);
    strictEqual(result.size, 0);
  });

  it('groups a single event by date', () => {
    const events = [
      {
        type: 'PushEvent',
        created_at: '2024-03-15T10:00:00Z',
        repo: { name: 'alice/repo-a' },
      },
    ];
    const result = summarize(events, tz);
    strictEqual(result.size, 1);
    const [date, counts] = [...result.entries()][0];
    ok(date.includes('2024'), 'date key should contain year');
    strictEqual(counts['alice/repo-a::commit'], 1);
  });

  it('aggregates multiple events of the same type on the same day', () => {
    const events = [
      { type: 'PushEvent', created_at: '2024-03-15T08:00:00Z', repo: { name: 'alice/repo-a' } },
      { type: 'PushEvent', created_at: '2024-03-15T09:00:00Z', repo: { name: 'alice/repo-a' } },
    ];
    const result = summarize(events, tz);
    const counts = [...result.values()][0];
    strictEqual(counts['alice/repo-a::commit'], 2);
  });

  it('separates events from different repos on the same day', () => {
    const events = [
      { type: 'PushEvent', created_at: '2024-03-15T08:00:00Z', repo: { name: 'alice/repo-a' } },
      { type: 'PushEvent', created_at: '2024-03-15T09:00:00Z', repo: { name: 'alice/repo-b' } },
    ];
    const result = summarize(events, tz);
    const counts = [...result.values()][0];
    strictEqual(counts['alice/repo-a::commit'], 1);
    strictEqual(counts['alice/repo-b::commit'], 1);
  });

  it('separates events from different days', () => {
    const events = [
      { type: 'PushEvent', created_at: '2024-03-15T08:00:00Z', repo: { name: 'alice/repo-a' } },
      { type: 'PushEvent', created_at: '2024-03-16T08:00:00Z', repo: { name: 'alice/repo-a' } },
    ];
    const result = summarize(events, tz);
    strictEqual(result.size, 2);
  });

  it('uses "unknown" when event has no repo name', () => {
    const events = [
      { type: 'PushEvent', created_at: '2024-03-15T08:00:00Z' },
    ];
    const result = summarize(events, tz);
    const counts = [...result.values()][0];
    strictEqual(counts['unknown::commit'], 1);
  });

  it('filters events when includeTypes is provided', () => {
    const events = [
      { type: 'PushEvent', created_at: '2024-03-15T08:00:00Z', repo: { name: 'alice/repo-a' } },
      { type: 'IssuesEvent', created_at: '2024-03-15T09:00:00Z', repo: { name: 'alice/repo-a' } },
    ];
    const result = summarize(events, tz, ['commit']);
    const counts = [...result.values()][0];
    strictEqual(counts['alice/repo-a::commit'], 1);
    strictEqual(counts['alice/repo-a::issue'], undefined);
  });
});

describe('detailed', () => {
  const tz = 'UTC';

  it('returns an empty map for empty events array', () => {
    const result = detailed([], tz);
    strictEqual(result.size, 0);
  });

  it('groups push events by date and repo with commit messages', () => {
    const events = [
      {
        type: 'PushEvent',
        created_at: '2024-03-15T08:00:00Z',
        repo: { name: 'alice/repo-a' },
        payload: {
          commits: [
            { message: 'Fix bug\nMore details' },
            { message: 'Add feature' },
          ],
        },
      },
    ];
    const result = detailed(events, tz);
    const dayMap = [...result.values()][0];
    const entries = dayMap.get('alice/repo-a');
    ok(Array.isArray(entries));
    strictEqual(entries.length, 2);
    strictEqual(entries[0], 'commit: Fix bug');
    strictEqual(entries[1], 'commit: Add feature');
  });

  it('uses first line only of multi-line commit messages', () => {
    const events = [
      {
        type: 'PushEvent',
        created_at: '2024-03-15T08:00:00Z',
        repo: { name: 'alice/repo-a' },
        payload: { commits: [{ message: 'Summary\n\nBody paragraph' }] },
      },
    ];
    const result = detailed(events, tz);
    const entries = [...result.values()][0].get('alice/repo-a');
    strictEqual(entries[0], 'commit: Summary');
  });

  it('handles push events with no commits gracefully', () => {
    const events = [
      {
        type: 'PushEvent',
        created_at: '2024-03-15T08:00:00Z',
        repo: { name: 'alice/repo-a' },
        payload: { commits: [] },
      },
    ];
    const result = detailed(events, tz);
    const dayMap = [...result.values()][0];
    const entries = dayMap.get('alice/repo-a');
    strictEqual(entries.length, 0);
  });

  it('appends issue title to issue events', () => {
    const events = [
      {
        type: 'IssuesEvent',
        created_at: '2024-03-15T08:00:00Z',
        repo: { name: 'alice/repo-a' },
        payload: { issue: { title: 'Bug report' } },
      },
    ];
    const result = detailed(events, tz);
    const entries = [...result.values()][0].get('alice/repo-a');
    strictEqual(entries[0], 'issue: Bug report');
  });

  it('appends PR title to pull request events', () => {
    const events = [
      {
        type: 'PullRequestEvent',
        created_at: '2024-03-15T08:00:00Z',
        repo: { name: 'alice/repo-a' },
        payload: { pull_request: { title: 'Add new feature' } },
      },
    ];
    const result = detailed(events, tz);
    const entries = [...result.values()][0].get('alice/repo-a');
    strictEqual(entries[0], 'pull request: Add new feature');
  });

  it('appends discussion title to discussion events', () => {
    const events = [
      {
        type: 'DiscussionEvent',
        created_at: '2024-03-15T08:00:00Z',
        repo: { name: 'alice/repo-a' },
        payload: { discussion: { title: 'Question about X' } },
      },
    ];
    const result = detailed(events, tz);
    const entries = [...result.values()][0].get('alice/repo-a');
    strictEqual(entries[0], 'discussion: Question about X');
  });

  it('filters events when includeTypes is provided', () => {
    const events = [
      {
        type: 'PushEvent',
        created_at: '2024-03-15T08:00:00Z',
        repo: { name: 'alice/repo-a' },
        payload: { commits: [{ message: 'Fix' }] },
      },
      {
        type: 'IssuesEvent',
        created_at: '2024-03-15T09:00:00Z',
        repo: { name: 'alice/repo-a' },
        payload: { issue: { title: 'Bug' } },
      },
    ];
    const result = detailed(events, tz, ['commit']);
    const dayMap = [...result.values()][0];
    const entries = dayMap.get('alice/repo-a');
    strictEqual(entries.length, 1);
    strictEqual(entries[0], 'commit: Fix');
  });

  it('uses "unknown" when event has no repo', () => {
    const events = [
      {
        type: 'IssuesEvent',
        created_at: '2024-03-15T08:00:00Z',
        payload: { issue: { title: 'Orphan issue' } },
      },
    ];
    const result = detailed(events, tz);
    const dayMap = [...result.values()][0];
    ok(dayMap.has('unknown'));
  });
});
