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
