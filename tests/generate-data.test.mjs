/**
 * Tests for generate-data.mjs utility functions:
 *   parseSimpleYaml, classifyEvent, getNextScheduledDate, processEvents
 */

import { describe, it } from 'node:test';
import { strictEqual, deepStrictEqual, ok } from 'node:assert';

// ── parseSimpleYaml ──────────────────────────────────────────────────────────
// Verbatim copy from generate-data.mjs / generate-usage.mjs (both are identical).

function parseSimpleYaml(yamlString) {
  const lines = yamlString.split('\n');
  const result = {};
  const stack = [{ obj: result, indent: -1 }];

  for (const line of lines) {
    if (line.trim().startsWith('#') || line.trim() === '') continue;

    const indent = line.search(/\S/);
    const trimmed = line.trim();

    if (trimmed.includes(':')) {
      const [key, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();
      const cleanKey = key.trim();

      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }

      const parent = stack[stack.length - 1].obj;

      if (value === '') {
        const obj = {};
        parent[cleanKey] = obj;
        stack.push({ obj, indent });
      } else {
        if (value === 'true') parent[cleanKey] = true;
        else if (value === 'false') parent[cleanKey] = false;
        else if (!isNaN(value) && value !== '') parent[cleanKey] = Number(value);
        else if (value === '[]') parent[cleanKey] = [];
        else parent[cleanKey] = value;
      }
    }
  }

  return result;
}

// ── classifyEvent ────────────────────────────────────────────────────────────
// Same implementation as in generate-data.mjs.

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

// ── getNextScheduledDate ─────────────────────────────────────────────────────
// Verbatim copy from generate-data.mjs.

function getNextScheduledDate(frequency, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();

  if (frequency === 'bimonthly') {
    const fifteenth = new Date(year, month, 15);
    const lastDay = new Date(year, month + 1, 0);

    if (now < fifteenth) return fifteenth.toISOString().split('T')[0];
    if (now < lastDay) return lastDay.toISOString().split('T')[0];

    return new Date(year, month + 1, 15).toISOString().split('T')[0];
  } else {
    const lastDay = new Date(year, month + 1, 0);
    if (now < lastDay) return lastDay.toISOString().split('T')[0];
    return new Date(year, month + 2, 0).toISOString().split('T')[0];
  }
}

// ── processEvents ────────────────────────────────────────────────────────────
// Adapted from generate-data.mjs; module-level globals (INCLUDE_TYPES, USER)
// are passed as explicit parameters to make the function unit-testable.

function dfmt(dt, tz) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dt);
}

function processEvents(events, tz, aggregateOnly, includeTypes = null, user = 'testuser') {
  const byDay = new Map();
  const repoStats = new Map();
  const typeStats = new Map();

  for (const e of events) {
    const type = classifyEvent(e);
    if (includeTypes && Array.isArray(includeTypes) && includeTypes.length > 0 && !includeTypes.includes(type)) {
      continue;
    }

    const date = dfmt(new Date(e.created_at), tz);
    const repo = e.repo?.name || 'unknown';
    const isPrivate = e.repo?.name?.includes('/') && e.public === false;

    if (!byDay.has(date)) {
      byDay.set(date, { date, total: 0, byType: {}, byRepo: {}, events: [] });
    }

    const dayData = byDay.get(date);
    dayData.total++;

    dayData.byType[type] = (dayData.byType[type] || 0) + 1;
    typeStats.set(type, (typeStats.get(type) || 0) + 1);

    if (aggregateOnly && isPrivate) {
      dayData.byRepo['private-repos'] = (dayData.byRepo['private-repos'] || 0) + 1;
      repoStats.set('private-repos', (repoStats.get('private-repos') || 0) + 1);
    } else {
      dayData.byRepo[repo] = (dayData.byRepo[repo] || 0) + 1;
      repoStats.set(repo, (repoStats.get(repo) || 0) + 1);

      let eventDetail = { type, repo, timestamp: e.created_at };

      if (type === 'commit' && e.payload?.commits) {
        eventDetail.commits = e.payload.commits.map(c => ({
          message: c.message?.split('\n')[0] || '(no message)',
          sha: c.sha?.substring(0, 7),
        }));
      } else {
        if (e.payload?.issue) {
          eventDetail.title = e.payload.issue.title;
          eventDetail.number = e.payload.issue.number;
          eventDetail.url = e.payload.issue.html_url;
        }
        if (e.payload?.pull_request) {
          eventDetail.title = e.payload.pull_request.title;
          eventDetail.number = e.payload.pull_request.number;
          eventDetail.url = e.payload.pull_request.html_url;
        }
        if (e.payload?.discussion) {
          eventDetail.title = e.payload.discussion.title;
          eventDetail.url = e.payload.discussion.html_url;
        }
      }

      dayData.events.push(eventDetail);
    }
  }

  const DAYS = 31;
  const dailyActivity = Array.from(byDay.values())
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const topRepos = Array.from(repoStats.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([repo, count]) => ({ repo, count }));

  const topTypes = Array.from(typeStats.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));

  return {
    user,
    summary: {
      totalEvents: events.length,
      totalDaysWithActivity: dailyActivity.length,
      averagePerDay: (events.length / DAYS).toFixed(1),
      topRepositories: topRepos,
      activityByType: topTypes,
    },
    dailyActivity,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('parseSimpleYaml', () => {
  it('parses a simple key-value pair', () => {
    const yaml = 'default_user: mgifford\n';
    deepStrictEqual(parseSimpleYaml(yaml), { default_user: 'mgifford' });
  });

  it('parses boolean values', () => {
    const yaml = 'enabled: true\ndisabled: false\n';
    deepStrictEqual(parseSimpleYaml(yaml), { enabled: true, disabled: false });
  });

  it('parses numeric values', () => {
    const yaml = 'days: 31\ncount: 0\n';
    deepStrictEqual(parseSimpleYaml(yaml), { days: 31, count: 0 });
  });

  it('parses empty array shorthand', () => {
    const yaml = 'include_types: []\n';
    deepStrictEqual(parseSimpleYaml(yaml), { include_types: [] });
  });

  it('skips comment lines', () => {
    const yaml = '# This is a comment\nfoo: bar\n';
    deepStrictEqual(parseSimpleYaml(yaml), { foo: 'bar' });
  });

  it('skips empty lines', () => {
    const yaml = '\nfoo: bar\n\nbaz: qux\n';
    deepStrictEqual(parseSimpleYaml(yaml), { foo: 'bar', baz: 'qux' });
  });

  it('parses nested objects', () => {
    const yaml = 'schedule:\n  frequency: bimonthly\n  timezone: America/Toronto\n';
    deepStrictEqual(parseSimpleYaml(yaml), {
      schedule: {
        frequency: 'bimonthly',
        timezone: 'America/Toronto',
      },
    });
  });

  it('parses values containing colons (e.g., timezone)', () => {
    const yaml = 'timezone: America/Toronto\n';
    deepStrictEqual(parseSimpleYaml(yaml), { timezone: 'America/Toronto' });
  });

  it('parses the full config.yml structure', () => {
    const yaml = [
      'default_user: mgifford',
      'schedule:',
      '  frequency: bimonthly',
      '  timezone: America/Toronto',
      'activity:',
      '  days: 14',
      '  include_private_stats: true',
      '  include_types: []',
      'privacy:',
      '  aggregate_only: true',
      '  allow_user_queries: true',
    ].join('\n');
    const result = parseSimpleYaml(yaml);
    strictEqual(result.default_user, 'mgifford');
    strictEqual(result.schedule.frequency, 'bimonthly');
    strictEqual(result.schedule.timezone, 'America/Toronto');
    strictEqual(result.activity.days, 14);
    strictEqual(result.activity.include_private_stats, true);
    deepStrictEqual(result.activity.include_types, []);
    strictEqual(result.privacy.aggregate_only, true);
    strictEqual(result.privacy.allow_user_queries, true);
  });

  it('returns empty object for empty string', () => {
    deepStrictEqual(parseSimpleYaml(''), {});
  });

  it('returns empty object for string with only comments', () => {
    deepStrictEqual(parseSimpleYaml('# comment\n# another comment\n'), {});
  });
});

describe('getNextScheduledDate', () => {
  it('bimonthly: before the 15th returns the 15th of the current month', () => {
    // January 5, 2025
    const now = new Date(2025, 0, 5);
    strictEqual(getNextScheduledDate('bimonthly', now), '2025-01-15');
  });

  it('bimonthly: on the 15th returns the last day of the current month', () => {
    // January 15, 2025 — it's NOT before the 15th, so last day of January
    const now = new Date(2025, 0, 15, 12, 0, 0); // noon on the 15th
    // fifteenth = Jan 15 at midnight. now > fifteenth.
    // lastDay = Jan 31 at midnight. now < lastDay.
    strictEqual(getNextScheduledDate('bimonthly', now), '2025-01-31');
  });

  it('bimonthly: after the 15th but before the last day returns the last day', () => {
    // January 20, 2025
    const now = new Date(2025, 0, 20);
    strictEqual(getNextScheduledDate('bimonthly', now), '2025-01-31');
  });

  it('bimonthly: on the last day of the month returns the 15th of next month', () => {
    // January 31, 2025 at noon (not before lastDay midnight)
    const now = new Date(2025, 0, 31, 12, 0, 0);
    strictEqual(getNextScheduledDate('bimonthly', now), '2025-02-15');
  });

  it('bimonthly: handles month transitions correctly (December → January)', () => {
    // December 31, 2025 at noon
    const now = new Date(2025, 11, 31, 12, 0, 0);
    strictEqual(getNextScheduledDate('bimonthly', now), '2026-01-15');
  });

  it('monthly: before last day of month returns last day of current month', () => {
    // January 10, 2025
    const now = new Date(2025, 0, 10);
    strictEqual(getNextScheduledDate('monthly', now), '2025-01-31');
  });

  it('monthly: on last day of month returns last day of next month', () => {
    // January 31, 2025 at noon
    const now = new Date(2025, 0, 31, 12, 0, 0);
    strictEqual(getNextScheduledDate('monthly', now), '2025-02-28');
  });

  it('monthly: handles leap year February correctly', () => {
    // February 15, 2024 (2024 is a leap year)
    const now = new Date(2024, 1, 15);
    strictEqual(getNextScheduledDate('monthly', now), '2024-02-29');
  });
});

describe('processEvents', () => {
  const tz = 'UTC';

  it('returns structured output for empty event array', () => {
    const result = processEvents([], tz, false);
    strictEqual(result.summary.totalEvents, 0);
    strictEqual(result.summary.totalDaysWithActivity, 0);
    deepStrictEqual(result.dailyActivity, []);
    deepStrictEqual(result.summary.topRepositories, []);
    deepStrictEqual(result.summary.activityByType, []);
  });

  it('counts total events correctly', () => {
    const events = [
      { type: 'PushEvent', created_at: '2024-03-15T10:00:00Z', repo: { name: 'a/b' }, public: true },
      { type: 'IssuesEvent', created_at: '2024-03-15T11:00:00Z', repo: { name: 'a/b' }, public: true },
    ];
    const result = processEvents(events, tz, false);
    strictEqual(result.summary.totalEvents, 2);
  });

  it('counts days with activity correctly', () => {
    const events = [
      { type: 'PushEvent', created_at: '2024-03-15T10:00:00Z', repo: { name: 'a/b' }, public: true },
      { type: 'PushEvent', created_at: '2024-03-16T10:00:00Z', repo: { name: 'a/b' }, public: true },
    ];
    const result = processEvents(events, tz, false);
    strictEqual(result.summary.totalDaysWithActivity, 2);
  });

  it('includes top repositories sorted by event count', () => {
    const events = [
      { type: 'PushEvent', created_at: '2024-03-15T10:00:00Z', repo: { name: 'a/popular' }, public: true },
      { type: 'PushEvent', created_at: '2024-03-15T11:00:00Z', repo: { name: 'a/popular' }, public: true },
      { type: 'PushEvent', created_at: '2024-03-15T12:00:00Z', repo: { name: 'a/other' }, public: true },
    ];
    const result = processEvents(events, tz, false);
    strictEqual(result.summary.topRepositories[0].repo, 'a/popular');
    strictEqual(result.summary.topRepositories[0].count, 2);
    strictEqual(result.summary.topRepositories[1].repo, 'a/other');
    strictEqual(result.summary.topRepositories[1].count, 1);
  });

  it('aggregates private repo events when aggregateOnly is true', () => {
    const events = [
      {
        type: 'PushEvent',
        created_at: '2024-03-15T10:00:00Z',
        repo: { name: 'alice/private-thing' },
        public: false,
      },
    ];
    const result = processEvents(events, tz, true);
    const repos = result.summary.topRepositories.map(r => r.repo);
    ok(repos.includes('private-repos'), 'private repo should be aggregated as "private-repos"');
  });

  it('does not aggregate public events even when aggregateOnly is true', () => {
    const events = [
      {
        type: 'PushEvent',
        created_at: '2024-03-15T10:00:00Z',
        repo: { name: 'alice/public-thing' },
        public: true,
      },
    ];
    const result = processEvents(events, tz, true);
    const repos = result.summary.topRepositories.map(r => r.repo);
    ok(repos.includes('alice/public-thing'), 'public repo should appear by name');
    ok(!repos.includes('private-repos'), 'should not be aggregated');
  });

  it('filters events by includeTypes when provided', () => {
    const events = [
      { type: 'PushEvent', created_at: '2024-03-15T10:00:00Z', repo: { name: 'a/b' }, public: true },
      { type: 'IssuesEvent', created_at: '2024-03-15T11:00:00Z', repo: { name: 'a/b' }, public: true },
    ];
    const result = processEvents(events, tz, false, ['commit']);
    strictEqual(result.summary.activityByType.length, 1);
    strictEqual(result.summary.activityByType[0].type, 'commit');
  });

  it('includes commit details in event detail records', () => {
    const events = [
      {
        type: 'PushEvent',
        created_at: '2024-03-15T10:00:00Z',
        repo: { name: 'a/b' },
        public: true,
        payload: {
          commits: [
            { message: 'First commit\nBody', sha: 'abc1234xyz' },
          ],
        },
      },
    ];
    const result = processEvents(events, tz, false);
    const dayEvents = result.dailyActivity[0].events;
    strictEqual(dayEvents[0].commits[0].message, 'First commit');
    strictEqual(dayEvents[0].commits[0].sha, 'abc1234');
  });

  it('includes issue title in event detail records', () => {
    const events = [
      {
        type: 'IssuesEvent',
        created_at: '2024-03-15T10:00:00Z',
        repo: { name: 'a/b' },
        public: true,
        payload: {
          issue: { title: 'Bug report', number: 42, html_url: 'https://github.com/a/b/issues/42' },
        },
      },
    ];
    const result = processEvents(events, tz, false);
    const ev = result.dailyActivity[0].events[0];
    strictEqual(ev.title, 'Bug report');
    strictEqual(ev.number, 42);
    strictEqual(ev.url, 'https://github.com/a/b/issues/42');
  });
});
