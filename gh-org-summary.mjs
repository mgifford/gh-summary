#!/usr/bin/env node
/*
  GitHub Organization Activity Summarizer (Node 18+)
  -------------------------------------------
  • Groups by day, org/repo, user, counts activity types
  • With --detailed: shows full list of events, grouped by org/repo, day, user
  • With --include <types>: filter to only certain event types (comma-separated)

  Usage examples:
    node gh-org-summary.mjs --org civicactions --days 31
    node gh-org-summary.mjs --org civicactions --days 7 --detailed
    node gh-org-summary.mjs --org civicactions --include commit,issue,discussion
*/

function normalizeDashes(token) {
  return token.replace(/[-83D]/g, '-');
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
  console.log(`\nGitHub Organization Activity Summarizer\n\nOptions:\n  --org <orgname>           GitHub organization (required)\n  --days <n>                Number of days to look back (default: 31)\n  --timezone <tz>           Timezone, e.g. Europe/Paris (default: system tz)\n  --include-private         Include private events (requires GITHUB_TOKEN)\n  --detailed                Show detailed listing of all events\n  --include <types>         Comma-separated list of types to include (e.g. commit,issue,discussion)\n  --help                    Show this help screen\n`);
}

const rawArgs = process.argv.slice(2);
const args = parseArgs(rawArgs);

if (args.help || Object.keys(args).length === 0) {
  showHelp();
  process.exit(0);
}

// Clean up org name - remove any URL parts and just get the org name
const cleanOrgName = (orgName) => {
  // Handle different URL formats and raw org names
  let name = orgName
    .replace(/^https?:\/\/[^\/]+\//, '')    // Remove protocol and domain
    .replace(/^orgs\//, '')                 // Remove 'orgs/' prefix if present
    .replace(/\/$/, '');                    // Remove trailing slash
  
  // Split on slashes and get the relevant part
  name = name.split('/').filter(Boolean)[0] || name;
  
  // Special case: preserve USDS as is
  if (name.toLowerCase() === 'usds') {
    name = 'usds';
  }
  
  return {
    original: name,                         // Preserve original case
    lower: name.toLowerCase()               // Lowercase for API calls
  };
};

const orgNames = cleanOrgName(String(args.org || '').trim());
const ORG = orgNames.lower;               // Use lowercase for API
const ORG_DISPLAY = orgNames.original;    // Use original case for display
const DAYS = Number(args.days || 31);
const TZ = String(args.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
const INCLUDE_PRIVATE = Boolean(args['include-private'] || false);
const DETAILED = Boolean(args['detailed'] || false);
const INCLUDE_TYPES = args['include'] ? String(args['include']).split(',').map(s => s.trim().toLowerCase()) : null;
const SINCE = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

if (!ORG) {
  console.error('Error: --org <github-organization> is required');
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
    'User-Agent': 'gh-org-summary'
  };
  if (GITHUB_TOKEN) headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  return headers;
}

async function ghJson(url, silent = false) {
  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
      if (res.status === 403 || res.status === 401) {
        if (!silent) {
          console.warn(`Warning: Limited access to ${url.split('?')[0]} (${res.status})`);
        }
        return { items: [], link: '' };
      }
      const text = await res.text();
      throw new Error(`GitHub API ${res.status} for ${url}: ${text}`);
    }
    const link = res.headers.get('link') || '';
    const items = await res.json();
    return { items, link };
  } catch (err) {
    if (!silent) {
      console.warn(`Warning: Failed to fetch ${url.split('?')[0]}: ${err.message}`);
    }
    return { items: [], link: '' };
  }
}

function parseLinkHeader(link) {
  return Object.fromEntries((link || '').split(',').map(s => s.trim()).filter(Boolean).map(part => {
    const m = part.match(/^<([^>]+)>;\s*rel="([^"]+)"/);
    return m ? [m[2], m[1]] : null;
  }).filter(Boolean));
}

async function fetchUserDetails(username) {
  const endpoint = `${API}/users/${encodeURIComponent(username)}`;
  const { items } = await ghJson(endpoint, true);
  return items || {
    login: username,
    name: null,
    location: null,
    bio: null,
    public_repos: 0,
    created_at: null
  };
}

async function fetchOrgTeamMembers(org) {
  const teams = [];
  let page = 1;
  while (true) {
    const endpoint = `${API}/orgs/${encodeURIComponent(org)}/teams?per_page=100&page=${page}`;
    const { items, link } = await ghJson(endpoint, true);
    if (!Array.isArray(items) || items.length === 0) break;
    teams.push(...items);
    const rel = parseLinkHeader(link);
    if (!rel.next) break;
    page += 1;
  }
  
  const teamMembers = [];
  for (const team of teams) {
    const endpoint = `${API}/teams/${team.id}/members`;
    const { items } = await ghJson(endpoint);
    if (Array.isArray(items)) {
      teamMembers.push(...items);
    }
  }
  return teamMembers;
}

async function fetchWebPage(url) {
  try {
    const response = await fetch(url);
    return await response.text();
  } catch (err) {
    console.warn(`Warning: Failed to fetch webpage ${url}: ${err.message}`);
    return '';
  }
}

async function extractMembersFromWebPage(org) {
  const url = `https://github.com/orgs/${org}/people`;
  const html = await fetchWebPage(url);
  
  // More comprehensive regex to extract usernames and names from the page
  const memberPattern = /(?:href="\/|@)([a-zA-Z0-9-]+)(?:"|>|\))\s*(?:\((.*?)\)|([^<\n]+))?/g;
  const members = new Map();
  
  let match;
  while ((match = memberPattern.exec(html)) !== null) {
    const [_, username, name] = match;
    if (!members.has(username)) {
      members.set(username, {
        login: username,
        details: {
          name: name,
          source: 'web'
        }
      });
    }
  }
  
  return Array.from(members.values());
}

async function fetchOrgMembers(org) {
  let page = 1;
  let out = new Map();
  let hasNextPage = true;
  
  // Try API first
  while (hasNextPage) {
    const endpoint = `${API}/orgs/${encodeURIComponent(org)}/members?per_page=100&page=${page}&role=all`;
    const { items, link } = await ghJson(endpoint);
    
    // If API fails or no items on first page, try web scraping
    if (!Array.isArray(items) || items.length === 0) {
      if (page === 1) {
        console.warn('Warning: API access limited, falling back to public web page');
        const webMembers = await extractMembersFromWebPage(org);
        for (const member of webMembers) {
          out.set(member.login, member);
        }
      }
      break;
    }
    
    // Fetch detailed information for each member
    const detailedMembers = await Promise.all(
      items.map(async (member) => {
        const details = await fetchUserDetails(member.login);
        return {
          ...member,
          details
        };
      })
    );
    
    for (const member of detailedMembers) {
      out.set(member.login, member);
    }
    const rel = parseLinkHeader(link);
    hasNextPage = !!rel.next;
    console.log(`Fetched page ${page} with ${detailedMembers.length} members. Total so far: ${out.size}`);
    
    page += 1;
    // Add small delay to avoid rate limiting
    if (hasNextPage) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  // Fetch team members
  const teamMembers = await fetchOrgTeamMembers(org);
  for (const member of teamMembers) {
    if (!out.has(member.login)) {
      const details = await fetchUserDetails(member.login);
      out.set(member.login, { ...member, details });
    }
  }
  
  return Array.from(out.values());
}

async function fetchUserEvents(username, since, includePrivate) {
  const perPage = 100;
  let page = 1;
  let out = [];
  let reachedEnd = false;
  
  // Try different event endpoints in order of privacy
  const endpoints = [
    // Try org-specific events first
    `${API}/users/${encodeURIComponent(username)}/events/orgs/${encodeURIComponent(ORG)}`,
    // Then try public events
    `${API}/users/${encodeURIComponent(username)}/events/public`,
    // Then try private events if requested
    ...(includePrivate ? [`${API}/users/${encodeURIComponent(username)}/events`] : [])
  ];
    
  for (const baseEndpoint of endpoints) {
    page = 1;
    while (!reachedEnd) {
      const endpoint = `${baseEndpoint}?per_page=${perPage}&page=${page}`;
      const { items, link } = await ghJson(endpoint, true);
      
      if (!Array.isArray(items) || items.length === 0) break;
      
      // Add events that are within our date range
      const validEvents = items.filter(e => new Date(e.created_at) >= since);
      out.push(...validEvents);
      
      // If we got fewer valid events than items, we've reached events too old
      if (validEvents.length < items.length) {
        reachedEnd = true;
        break;
      }
      
      const rel = parseLinkHeader(link);
      if (!rel.next) break;
      
      page += 1;
      if (page > 30) break; // Increased page limit to ensure we get more history
    }
  }
  
  // Sort events by date, newest first
  return out.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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
    const repoUrl = `https://github.com/${repo}`;
    const key = `${repoUrl}::${type}`;
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
    const repoUrl = `https://github.com/${repo}`;
    if (!map.get(d).has(repoUrl)) map.get(d).set(repoUrl, []);
    
    let desc = type;
    if (type === 'commit') {
      const commits = e.payload?.commits || [];
      for (const c of commits) {
        // Add commit URL if available
        const commitUrl = c.url ? `\n    ${c.url}` : '';
        map.get(d).get(repoUrl).push(`commit: ${c.message?.split('\n')[0] || '(no message)'}${commitUrl}`);
      }
      continue;
    }
    
    // Add URLs for different types of activities
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

(async function main() {
  try {
    console.log(`Fetching information for organization: ${ORG_DISPLAY}`);
    
    // Verify organization exists first
    const orgCheckUrl = `${API}/orgs/${encodeURIComponent(ORG)}`;
    try {
      const { items: orgInfo } = await ghJson(orgCheckUrl, true);
      if (!orgInfo || !orgInfo.login) {
        console.error(`Error: Organization '${ORG_DISPLAY}' not found. Please check the organization name.`);
        process.exit(1);
      }
      console.log(`Found organization: ${orgInfo.name || orgInfo.login}`);
    } catch (err) {
      console.error(`Error: Could not verify organization '${ORG}'. ${err.message}`);
      process.exit(1);
    }
    
    // Try web page first
    console.log('Fetching from public web page...');
    const webMembers = await extractMembersFromWebPage(ORG);
    // Then try API
    console.log('Fetching from GitHub API...');
    const apiMembers = await fetchOrgMembers(ORG);
    
    // Combine results
    const members = [...new Set([...webMembers, ...apiMembers])];
    
    if (members.length === 0) {
      console.log('No members found. This could be due to:');
      console.log('- Limited API permissions');
      console.log('- Organization privacy settings');
      console.log('- Invalid organization name');
      console.log('\nTry:');
      console.log('1. Using a token with more permissions');
      console.log('2. Checking the organization name');
      process.exit(1);
    }

    console.log(`\nFound ${members.length} members in ${ORG}:`);
    for (const m of members) {
      const d = m.details;
      console.log(`\n- ${m.login}${d.name ? ` (${d.name})` : ''}
    Location: ${d.location || 'Not specified'}
    Bio: ${d.bio ? d.bio.split('\n')[0] : 'Not specified'}
    Public repos: ${d.public_repos || 0}
    Account created: ${d.created_at ? new Date(d.created_at).toLocaleDateString() : 'Unknown'}`);
    }
    console.log('');
    
    // Track activity stats
    const userActivity = new Map();
    const projectActivity = new Map();
    let totalEvents = 0;
    
    for (const m of members) {
      console.log(`Activity for ${m.login}:`);
      const events = await fetchUserEvents(m.login, SINCE, INCLUDE_PRIVATE);
      
      // Update user activity count
      userActivity.set(m.login, (userActivity.get(m.login) || 0) + events.length);
      totalEvents += events.length;
      
      // Update project activity counts
      events.forEach(e => {
        const repo = e.repo?.name || 'unknown';
        projectActivity.set(repo, (projectActivity.get(repo) || 0) + 1);
      });
      
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
            const [repoUrl, type] = key.split('::');
            console.log(`  ${counts[key]} actions: ${type}`);
            console.log(`    ${repoUrl}`);
          }
          console.log('');
        }
      }
    }

    // Print Summary
    console.log('\n=== Activity Summary ===');
    console.log(`Total Events in the last ${DAYS} days: ${totalEvents}`);
    console.log(`Average Events per day: ${(totalEvents / DAYS).toFixed(1)}`);
    
    console.log('\nTop 10 Most Active Contributors:');
    [...userActivity.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([user, count]) => {
        console.log(`  ${user}: ${count} events`);
      });
    
    console.log('\nTop 10 Most Active Projects:');
    [...projectActivity.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([repo, count]) => {
        console.log(`  ${repo}: ${count} events`);
      });
    
  } catch (err) {
    console.error('Failed:', err?.message || err);
    process.exit(2);
  }
})();
