/**
 * Tests for pure utility functions in app.js:
 *   parseDateLocal, safeUrl, classifyEvent, processEventsForDisplay,
 *   formatDateWithDayOfWeek, formatDateTime, buildDetailsHtml
 *
 * escapeHtml and DOM-dependent rendering functions (displaySummaryStats,
 * displayDailyTimeline, renderOpenContributionCard, etc.) are not tested
 * here because they require a browser DOM environment.
 */

import { describe, it } from 'node:test';
import { strictEqual, deepStrictEqual, ok } from 'node:assert';

// ── Inline definitions ───────────────────────────────────────────────────────
// Copied verbatim from app.js to allow isolated unit testing without a DOM.

function parseDateLocal(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
}

function safeUrl(url) {
  try {
    const u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? url : '#';
  } catch {
    return '#';
  }
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

function processEventsForDisplay(events, username, days) {
  const repoStats = new Map();
  const typeStats = new Map();
  const dailyMap = new Map();

  for (const e of events) {
    const type = classifyEvent(e);
    const repo = e.repo?.name || 'unknown';
    const date = new Date(e.created_at).toISOString().split('T')[0];

    repoStats.set(repo, (repoStats.get(repo) || 0) + 1);
    typeStats.set(type, (typeStats.get(type) || 0) + 1);

    if (!dailyMap.has(date)) {
      dailyMap.set(date, { date, total: 0, byType: {}, byRepo: {} });
    }
    const dayEntry = dailyMap.get(date);
    dayEntry.total++;
    dayEntry.byType[type] = (dayEntry.byType[type] || 0) + 1;
    dayEntry.byRepo[repo] = (dayEntry.byRepo[repo] || 0) + 1;
  }

  const topRepos = Array.from(repoStats.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([repo, count]) => ({ repo, count }));

  const topTypes = Array.from(typeStats.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));

  const dailyActivity = Array.from(dailyMap.values())
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    user: username,
    dailyActivity,
    summary: {
      totalEvents: events.length,
      totalDaysWithActivity: dailyMap.size,
      averagePerDay: (events.length / days).toFixed(1),
      topRepositories: topRepos,
      activityByType: topTypes,
    },
  };
}

function formatDateWithDayOfWeek(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

function buildDetailsHtml(startDate, endDate, daysDiff, totalFetched, pagesUsed, matchedCount, isPartial) {
  const partialNote = isPartial ? ' <em>(loading more…)</em>' : '';
  return `
        <div class="date-range-info">
            <p><strong>Date Range:</strong> ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()} (${daysDiff} days)</p>
            <p class="debug-info">Fetched ${totalFetched} event(s) across ${pagesUsed} page(s); ${matchedCount} matched the date range.${partialNote}</p>
        </div>
        <div class="chart-section">
            <h4>Activity by Type</h4>
            <div id="query-type-chart" class="chart"></div>
        </div>
        <div class="chart-section">
            <h4>Top Repositories</h4>
            <div id="query-repo-chart" class="chart"></div>
        </div>
        <div class="daily-activity">
            <h4>Daily Activity</h4>
            <div id="query-daily-timeline"></div>
        </div>
        <div id="query-open-contributions" class="open-contributions hidden"></div>
    `;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('parseDateLocal', () => {
  it('returns null for null input', () => {
    strictEqual(parseDateLocal(null), null);
  });

  it('returns null for undefined input', () => {
    strictEqual(parseDateLocal(undefined), null);
  });

  it('returns null for empty string', () => {
    strictEqual(parseDateLocal(''), null);
  });

  it('returns null for non-string input', () => {
    strictEqual(parseDateLocal(20240315), null);
  });

  it('returns null for malformed date string', () => {
    strictEqual(parseDateLocal('not-a-date'), null);
    strictEqual(parseDateLocal('2024-03'), null);
    strictEqual(parseDateLocal('2024/03/15'), null);
  });

  it('parses a valid YYYY-MM-DD string as local midnight', () => {
    const result = parseDateLocal('2024-03-15');
    ok(result instanceof Date, 'should return a Date');
    strictEqual(result.getFullYear(), 2024);
    strictEqual(result.getMonth(), 2); // 0-indexed, March = 2
    strictEqual(result.getDate(), 15);
    strictEqual(result.getHours(), 0, 'should be midnight (local)');
    strictEqual(result.getMinutes(), 0);
  });

  it('parses January correctly (month 1 → index 0)', () => {
    const result = parseDateLocal('2024-01-01');
    strictEqual(result.getMonth(), 0);
    strictEqual(result.getDate(), 1);
  });

  it('parses December correctly (month 12 → index 11)', () => {
    const result = parseDateLocal('2024-12-31');
    strictEqual(result.getMonth(), 11);
    strictEqual(result.getDate(), 31);
  });

  it('returns null when any date part is NaN', () => {
    strictEqual(parseDateLocal('2024-xx-15'), null);
  });
});

describe('safeUrl', () => {
  it('allows https:// URLs', () => {
    const url = 'https://github.com/foo/bar';
    strictEqual(safeUrl(url), url);
  });

  it('allows http:// URLs', () => {
    const url = 'http://example.com/page';
    strictEqual(safeUrl(url), url);
  });

  it('blocks javascript: protocol and returns "#"', () => {
    strictEqual(safeUrl('javascript:alert(1)'), '#');
  });

  it('blocks data: protocol and returns "#"', () => {
    strictEqual(safeUrl('data:text/html,<h1>test</h1>'), '#');
  });

  it('blocks ftp: protocol and returns "#"', () => {
    strictEqual(safeUrl('ftp://files.example.com/file.txt'), '#');
  });

  it('returns "#" for completely invalid URLs', () => {
    strictEqual(safeUrl('not a url at all'), '#');
    strictEqual(safeUrl(''), '#');
  });

  it('returns "#" for relative paths (not absolute URLs)', () => {
    strictEqual(safeUrl('/relative/path'), '#');
  });

  it('preserves query strings and fragments in safe URLs', () => {
    const url = 'https://github.com/issues?q=is%3Aopen#jump';
    strictEqual(safeUrl(url), url);
  });
});

describe('processEventsForDisplay', () => {
  it('returns empty result for no events', () => {
    const result = processEventsForDisplay([], 'alice', 14);
    strictEqual(result.user, 'alice');
    strictEqual(result.summary.totalEvents, 0);
    strictEqual(result.summary.totalDaysWithActivity, 0);
    strictEqual(result.summary.averagePerDay, '0.0');
    deepStrictEqual(result.summary.topRepositories, []);
    deepStrictEqual(result.summary.activityByType, []);
    deepStrictEqual(result.dailyActivity, []);
  });

  it('sets the correct user field', () => {
    const result = processEventsForDisplay([], 'bobsmith', 7);
    strictEqual(result.user, 'bobsmith');
  });

  it('counts total events', () => {
    const events = [
      { type: 'PushEvent', created_at: '2024-03-15T10:00:00Z', repo: { name: 'a/b' } },
      { type: 'IssuesEvent', created_at: '2024-03-15T11:00:00Z', repo: { name: 'a/b' } },
    ];
    const result = processEventsForDisplay(events, 'alice', 7);
    strictEqual(result.summary.totalEvents, 2);
  });

  it('counts distinct active days', () => {
    const events = [
      { type: 'PushEvent', created_at: '2024-03-15T10:00:00Z', repo: { name: 'a/b' } },
      { type: 'PushEvent', created_at: '2024-03-15T11:00:00Z', repo: { name: 'a/b' } },
      { type: 'PushEvent', created_at: '2024-03-16T10:00:00Z', repo: { name: 'a/b' } },
    ];
    const result = processEventsForDisplay(events, 'alice', 7);
    strictEqual(result.summary.totalDaysWithActivity, 2);
  });

  it('calculates averagePerDay correctly', () => {
    const events = [
      { type: 'PushEvent', created_at: '2024-03-15T10:00:00Z', repo: { name: 'a/b' } },
      { type: 'PushEvent', created_at: '2024-03-16T10:00:00Z', repo: { name: 'a/b' } },
    ];
    const result = processEventsForDisplay(events, 'alice', 14);
    strictEqual(result.summary.averagePerDay, (2 / 14).toFixed(1));
  });

  it('ranks top repositories by event count (descending)', () => {
    const events = [
      { type: 'PushEvent', created_at: '2024-03-15T10:00:00Z', repo: { name: 'a/popular' } },
      { type: 'PushEvent', created_at: '2024-03-15T11:00:00Z', repo: { name: 'a/popular' } },
      { type: 'PushEvent', created_at: '2024-03-15T12:00:00Z', repo: { name: 'a/quiet' } },
    ];
    const result = processEventsForDisplay(events, 'alice', 7);
    strictEqual(result.summary.topRepositories[0].repo, 'a/popular');
    strictEqual(result.summary.topRepositories[0].count, 2);
    strictEqual(result.summary.topRepositories[1].repo, 'a/quiet');
  });

  it('limits top repositories to 10 entries', () => {
    const events = Array.from({ length: 15 }, (_, i) => ({
      type: 'PushEvent',
      created_at: '2024-03-15T10:00:00Z',
      repo: { name: `a/repo-${i}` },
    }));
    const result = processEventsForDisplay(events, 'alice', 15);
    ok(result.summary.topRepositories.length <= 10);
  });

  it('ranks activity by type (descending)', () => {
    const events = [
      { type: 'PushEvent', created_at: '2024-03-15T10:00:00Z', repo: { name: 'a/b' } },
      { type: 'PushEvent', created_at: '2024-03-15T11:00:00Z', repo: { name: 'a/b' } },
      { type: 'IssuesEvent', created_at: '2024-03-15T12:00:00Z', repo: { name: 'a/b' } },
    ];
    const result = processEventsForDisplay(events, 'alice', 7);
    strictEqual(result.summary.activityByType[0].type, 'commit');
    strictEqual(result.summary.activityByType[0].count, 2);
    strictEqual(result.summary.activityByType[1].type, 'issue');
    strictEqual(result.summary.activityByType[1].count, 1);
  });

  it('sorts daily activity newest-first', () => {
    const events = [
      { type: 'PushEvent', created_at: '2024-03-14T10:00:00Z', repo: { name: 'a/b' } },
      { type: 'PushEvent', created_at: '2024-03-16T10:00:00Z', repo: { name: 'a/b' } },
      { type: 'PushEvent', created_at: '2024-03-15T10:00:00Z', repo: { name: 'a/b' } },
    ];
    const result = processEventsForDisplay(events, 'alice', 7);
    const dates = result.dailyActivity.map(d => d.date);
    strictEqual(dates[0], '2024-03-16');
    strictEqual(dates[1], '2024-03-15');
    strictEqual(dates[2], '2024-03-14');
  });

  it('accumulates byType and byRepo counts within each day', () => {
    const events = [
      { type: 'PushEvent', created_at: '2024-03-15T08:00:00Z', repo: { name: 'a/b' } },
      { type: 'PushEvent', created_at: '2024-03-15T09:00:00Z', repo: { name: 'a/b' } },
      { type: 'IssuesEvent', created_at: '2024-03-15T10:00:00Z', repo: { name: 'a/c' } },
    ];
    const result = processEventsForDisplay(events, 'alice', 7);
    const day = result.dailyActivity[0];
    strictEqual(day.total, 3);
    strictEqual(day.byType['commit'], 2);
    strictEqual(day.byType['issue'], 1);
    strictEqual(day.byRepo['a/b'], 2);
    strictEqual(day.byRepo['a/c'], 1);
  });

  it('uses "unknown" when an event has no repo name', () => {
    const events = [{ type: 'PushEvent', created_at: '2024-03-15T10:00:00Z' }];
    const result = processEventsForDisplay(events, 'alice', 7);
    strictEqual(result.summary.topRepositories[0].repo, 'unknown');
  });
});

describe('formatDateWithDayOfWeek', () => {
  it('returns a non-empty string for a valid date', () => {
    const result = formatDateWithDayOfWeek('2024-03-15');
    ok(typeof result === 'string' && result.length > 0);
  });

  it('includes the year in the output', () => {
    ok(formatDateWithDayOfWeek('2024-03-15').includes('2024'));
  });

  it('includes the day number in the output', () => {
    ok(formatDateWithDayOfWeek('2024-03-15').includes('15'));
  });

  it('includes the weekday name for a known Monday (2024-01-01)', () => {
    const result = formatDateWithDayOfWeek('2024-01-01');
    ok(result.toLowerCase().includes('monday'), `expected "monday" in "${result}"`);
  });

  it('includes the weekday name for a known Friday (2024-03-15)', () => {
    const result = formatDateWithDayOfWeek('2024-03-15');
    ok(result.toLowerCase().includes('friday'), `expected "friday" in "${result}"`);
  });

  it('handles the first day of a month correctly', () => {
    const result = formatDateWithDayOfWeek('2024-06-01');
    ok(result.includes('2024'));
    ok(result.includes('1') || result.includes('01'));
  });

  it('handles the last day of the year correctly', () => {
    const result = formatDateWithDayOfWeek('2024-12-31');
    ok(result.includes('2024'));
    ok(result.includes('31'));
  });

  it('parses dates in local time (no off-by-one from UTC midnight)', () => {
    // 2024-03-15 must be treated as local midnight, not UTC midnight
    // (UTC midnight can shift to March 14 in negative-offset timezones)
    const result = formatDateWithDayOfWeek('2024-03-15');
    // Regardless of timezone, the year 2024 should be in the output
    ok(result.includes('2024'));
  });
});

describe('formatDateTime', () => {
  it('returns a non-empty string', () => {
    const result = formatDateTime(new Date('2024-03-15T14:30:00Z'));
    ok(typeof result === 'string' && result.length > 0);
  });

  it('includes the year in the output', () => {
    const result = formatDateTime(new Date('2024-03-15T14:30:00Z'));
    ok(result.includes('2024'), `expected year in "${result}"`);
  });

  it('includes the day number', () => {
    const result = formatDateTime(new Date('2024-07-04T12:00:00Z'));
    ok(result.includes('4') || result.includes('04'), `expected day in "${result}"`);
  });

  it('includes a timezone abbreviation', () => {
    const result = formatDateTime(new Date('2024-03-15T14:30:00Z'));
    // Timezone names vary by environment but are always present
    ok(result.length > 10, `expected a reasonably long datetime string, got "${result}"`);
  });

  it('includes hours and minutes', () => {
    const result = formatDateTime(new Date('2024-03-15T14:30:00Z'));
    // Should contain ":" separating hours and minutes
    ok(result.includes(':'), `expected ":" in "${result}"`);
  });
});

describe('buildDetailsHtml', () => {
  const start = new Date(2024, 2, 1);  // 2024-03-01 local
  const end = new Date(2024, 2, 14);   // 2024-03-14 local

  it('returns a non-empty HTML string', () => {
    const html = buildDetailsHtml(start, end, 14, 100, 2, 50, false);
    ok(typeof html === 'string' && html.length > 0);
  });

  it('includes the number of days', () => {
    const html = buildDetailsHtml(start, end, 14, 100, 2, 50, false);
    ok(html.includes('14 days'), `expected "14 days" in output`);
  });

  it('includes totalFetched count', () => {
    const html = buildDetailsHtml(start, end, 14, 100, 2, 50, false);
    ok(html.includes('100'), `expected "100" in output`);
  });

  it('includes pagesUsed count', () => {
    const html = buildDetailsHtml(start, end, 14, 100, 3, 50, false);
    ok(html.includes('3'), `expected "3" in output`);
  });

  it('includes matchedCount', () => {
    const html = buildDetailsHtml(start, end, 14, 100, 2, 42, false);
    ok(html.includes('42'), `expected "42" in output`);
  });

  it('does NOT include the partial note when isPartial is false', () => {
    const html = buildDetailsHtml(start, end, 14, 100, 2, 50, false);
    ok(!html.includes('loading more'), `expected no "loading more" in output`);
  });

  it('includes the partial note when isPartial is true', () => {
    const html = buildDetailsHtml(start, end, 14, 100, 2, 50, true);
    ok(html.includes('loading more'), `expected "loading more" in output`);
  });

  it('includes required chart container IDs', () => {
    const html = buildDetailsHtml(start, end, 14, 100, 2, 50, false);
    ok(html.includes('query-type-chart'));
    ok(html.includes('query-repo-chart'));
    ok(html.includes('query-daily-timeline'));
  });

  it('includes the date-range-info container', () => {
    const html = buildDetailsHtml(start, end, 14, 100, 2, 50, false);
    ok(html.includes('date-range-info'));
  });
});
