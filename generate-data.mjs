#!/usr/bin/env node
/*
  GitHub Activity Data Generator for GitHub Pages
  ------------------------------------------------
  Generates JSON data files for the default user configured in config.yml
  Output is cached in _data/ directory for use by the web interface
*/

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

// Simple YAML parser (minimal implementation for this use case)
function parseSimpleYaml(yamlString) {
  const lines = yamlString.split('\n');
  const result = {};
  const stack = [{ obj: result, indent: -1 }];
  
  for (const line of lines) {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || line.trim() === '') continue;
    
    const indent = line.search(/\S/);
    const trimmed = line.trim();
    
    if (trimmed.includes(':')) {
      const [key, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();
      const cleanKey = key.trim();
      
      // Pop stack to find correct parent based on indentation
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }
      
      const parent = stack[stack.length - 1].obj;
      
      if (value === '') {
        // Nested object
        const obj = {};
        parent[cleanKey] = obj;
        stack.push({ obj, indent });
      } else {
        // Simple key-value
        // Parse value types
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

// Load configuration
let config;
try {
  const configFile = readFileSync('./config.yml', 'utf8');
  config = parseSimpleYaml(configFile);
} catch (err) {
  console.error('Error loading config.yml:', err.message);
  process.exit(1);
}

const USER = config.default_user || 'mgifford';
const DAYS = config.activity?.days || 31;
const INCLUDE_PRIVATE = config.activity?.include_private_stats || false;
const INCLUDE_TYPES = config.activity?.include_types || null;
const TZ = config.schedule?.timezone || 'America/Toronto';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const API = 'https://api.github.com';

console.log(`Generating activity data for user: ${USER}`);
console.log(`Looking back ${DAYS} days`);
console.log(`Include private stats: ${INCLUDE_PRIVATE}`);

// Ensure data directory exists
const dataDir = config.cache?.data_dir || '_data';
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

function authHeaders() {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'gh-summary-pages'
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

async function fetchUserEvents(username, days, includePrivate) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
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
    day: '2-digit' 
  }).format(dt);
}

function processEvents(events, tz, aggregateOnly) {
  const byDay = new Map();
  const repoStats = new Map();
  const typeStats = new Map();
  
  for (const e of events) {
    const type = classifyEvent(e);
    if (INCLUDE_TYPES && Array.isArray(INCLUDE_TYPES) && INCLUDE_TYPES.length > 0 && !INCLUDE_TYPES.includes(type)) {
      continue;
    }
    
    const date = dfmt(new Date(e.created_at), tz);
    const repo = e.repo?.name || 'unknown';
    const isPrivate = e.repo?.name?.includes('/') && e.public === false;
    
    // Initialize day data
    if (!byDay.has(date)) {
      byDay.set(date, {
        date,
        total: 0,
        byType: {},
        byRepo: {},
        events: []
      });
    }
    
    const dayData = byDay.get(date);
    dayData.total++;
    
    // Count by type
    dayData.byType[type] = (dayData.byType[type] || 0) + 1;
    typeStats.set(type, (typeStats.get(type) || 0) + 1);
    
    // For private repos, only aggregate stats if configured
    if (aggregateOnly && isPrivate) {
      dayData.byRepo['private-repos'] = (dayData.byRepo['private-repos'] || 0) + 1;
      repoStats.set('private-repos', (repoStats.get('private-repos') || 0) + 1);
    } else {
      dayData.byRepo[repo] = (dayData.byRepo[repo] || 0) + 1;
      repoStats.set(repo, (repoStats.get(repo) || 0) + 1);
      
      // Add detailed event info (for public repos or if not aggregate-only)
      let eventDetail = { type, repo, timestamp: e.created_at };
      
      if (type === 'commit' && e.payload?.commits) {
        eventDetail.commits = e.payload.commits.map(c => ({
          message: c.message?.split('\n')[0] || '(no message)',
          sha: c.sha?.substring(0, 7)
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
  
  // Convert maps to sorted arrays
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
    user: USER,
    generated: new Date().toISOString(),
    period: {
      days: DAYS,
      start: new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    },
    summary: {
      totalEvents: events.length,
      totalDaysWithActivity: dailyActivity.length,
      averagePerDay: (events.length / DAYS).toFixed(1),
      topRepositories: topRepos,
      activityByType: topTypes
    },
    dailyActivity
  };
}

// Main execution
(async function main() {
  try {
    console.log('Fetching events from GitHub...');
    const events = await fetchUserEvents(USER, DAYS, INCLUDE_PRIVATE);
    console.log(`Fetched ${events.length} events`);
    
    const aggregateOnly = config.privacy?.aggregate_only !== false;
    console.log(`Processing events (aggregate only: ${aggregateOnly})...`);
    
    const data = processEvents(events, TZ, aggregateOnly);
    
    // Write the data file
    const outputPath = `${dataDir}/activity.json`;
    writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`Data written to ${outputPath}`);
    
    // Write metadata file
    const metadata = {
      lastUpdate: new Date().toISOString(),
      user: USER,
      nextScheduled: getNextScheduledDate(config.schedule?.frequency || 'bimonthly')
    };
    writeFileSync(`${dataDir}/metadata.json`, JSON.stringify(metadata, null, 2));
    console.log(`Metadata written to ${dataDir}/metadata.json`);
    
    console.log('\nSummary:');
    console.log(`  Total events: ${data.summary.totalEvents}`);
    console.log(`  Days with activity: ${data.summary.totalDaysWithActivity}`);
    console.log(`  Average per day: ${data.summary.averagePerDay}`);
    console.log(`\nTop repositories:`);
    data.summary.topRepositories.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.repo}: ${r.count} events`);
    });
    
  } catch (err) {
    console.error('Failed:', err?.message || err);
    process.exit(2);
  }
})();

function getNextScheduledDate(frequency) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  if (frequency === 'bimonthly') {
    const fifteenth = new Date(year, month, 15);
    const lastDay = new Date(year, month + 1, 0); // Last day of current month
    
    if (now < fifteenth) return fifteenth.toISOString().split('T')[0];
    if (now < lastDay) return lastDay.toISOString().split('T')[0];
    
    // Next month's 15th
    return new Date(year, month + 1, 15).toISOString().split('T')[0];
  } else {
    // Monthly - last day of month
    const lastDay = new Date(year, month + 1, 0);
    if (now < lastDay) return lastDay.toISOString().split('T')[0];
    return new Date(year, month + 2, 0).toISOString().split('T')[0];
  }
}
