#!/usr/bin/env node
/*
  GitHub Usage Data Generator for GitHub Pages
  ---------------------------------------------
  Generates JSON data about GitHub Actions usage, Copilot status,
  Codespaces, and Projects for the default user configured in config.yml.
  Output is cached in _data/usage.json for use by the web interface.
*/

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

// Simple YAML parser (minimal implementation for this use case)
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
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const API = 'https://api.github.com';

console.log(`Generating usage data for user: ${USER}`);
console.log(`Looking back ${DAYS} days`);

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

async function ghFetch(url) {
  const res = await fetch(url, { headers: authHeaders() });
  return { status: res.status, ok: res.ok, data: res.ok ? await res.json() : null };
}

function logTokenScopeHint(section, requiredScope) {
  console.warn(`  ⚠ ${section}: requires "${requiredScope}" scope`);
  console.warn(`    Locally: export GITHUB_TOKEN=<PAT-with-${requiredScope}-scope>`);
  console.warn(`    In CI: add a GH_PAT repository secret with the "${requiredScope}" scope`);
  console.warn(`    See API-LIMITATIONS.md for full details`);
}

// Fetch user's public repos (sorted by last push, skip archived)
async function fetchUserRepos(username) {
  const repos = [];
  let page = 1;
  while (page <= 5) {
    const { ok, data } = await ghFetch(
      `${API}/users/${encodeURIComponent(username)}/repos?type=owner&sort=pushed&per_page=30&page=${page}`
    );
    if (!ok || !Array.isArray(data) || data.length === 0) break;
    repos.push(...data.filter(r => !r.archived));
    if (data.length < 30) break;
    page++;
  }
  return repos;
}

// Fetch recent workflow runs for a single repo within the period
async function fetchWorkflowRuns(ownerRepo, since) {
  const sinceStr = since.toISOString().split('T')[0];
  const url = `${API}/repos/${ownerRepo}/actions/runs?per_page=100&created=>=${sinceStr}`;
  const { ok, data } = await ghFetch(url);
  if (!ok || !data || !Array.isArray(data.workflow_runs)) return [];
  return data.workflow_runs;
}

// Try to fetch Copilot subscription status for the authenticated user
async function fetchCopilotStatus() {
  const { status, ok, data } = await ghFetch(`${API}/user/copilot`);
  if (ok && data) {
    return {
      available: true,
      planType: data.plan?.type || null,
      assignedAt: data.created_at || null,
      lastActivityAt: data.last_activity_at || null,
      lastActivityEditor: data.last_activity_editor || null
    };
  }
  if (status === 422) {
    return {
      available: false,
      reason: 'No active Copilot subscription found for this user'
    };
  }
  if (status === 401 || status === 403) {
    logTokenScopeHint('Copilot subscription', 'read:user');
    return {
      available: false,
      reason: 'Requires a Personal Access Token (PAT) with read:user scope — default GITHUB_TOKEN does not include this scope'
    };
  }
  return {
    available: false,
    reason: 'Requires an authenticated token with read:user scope'
  };
}

// Try to fetch Copilot metrics for orgs the user belongs to.
// Requires manage_billing:copilot scope — will fail gracefully without it.
async function fetchCopilotOrgMetrics(username) {
  // Get user's org memberships
  const { ok: orgsOk, data: orgs } = await ghFetch(`${API}/user/orgs?per_page=30`);
  if (!orgsOk || !Array.isArray(orgs) || orgs.length === 0) {
    return { available: false, reason: 'No org memberships accessible or token lacks read:org scope' };
  }

  const results = [];
  for (const org of orgs.slice(0, 5)) {
    const { ok, data } = await ghFetch(`${API}/orgs/${encodeURIComponent(org.login)}/copilot/metrics`);
    if (ok && Array.isArray(data) && data.length > 0) {
      // Summarise the most recent entry
      const latest = data[data.length - 1];
      results.push({
        org: org.login,
        date: latest.date,
        totalActiveUsers: latest.total_active_users || 0,
        totalEngagedUsers: latest.total_engaged_users || 0
      });
    }
  }

  if (results.length === 0) {
    logTokenScopeHint('Copilot org metrics', 'manage_billing:copilot');
    return {
      available: false,
      reason: 'Copilot metrics require manage_billing:copilot scope (org admin only)'
    };
  }

  return { available: true, orgs: results };
}

// Try to list Codespaces for the authenticated user
async function fetchCodespaces() {
  const { status, ok, data } = await ghFetch(`${API}/user/codespaces?per_page=30`);
  if (ok && data) {
    const spaces = Array.isArray(data.codespaces) ? data.codespaces : [];
    return {
      available: true,
      totalCount: data.total_count || spaces.length,
      items: spaces.map(cs => ({
        name: cs.name,
        displayName: cs.display_name || cs.name,
        repository: cs.repository?.full_name || null,
        state: cs.state,
        createdAt: cs.created_at,
        lastUsedAt: cs.last_used_at || null,
        machineDisplayName: cs.machine?.display_name || null
      }))
    };
  }
  if (status === 401 || status === 403) {
    logTokenScopeHint('Codespaces', 'codespace');
    return { available: false, reason: 'Requires a Personal Access Token (PAT) with codespace scope — default GITHUB_TOKEN does not include this scope' };
  }
  return { available: false, reason: 'Codespaces information not accessible' };
}

// Try to fetch the user's classic Projects
async function fetchProjects(username) {
  const { ok, data } = await ghFetch(
    `${API}/users/${encodeURIComponent(username)}/projects?per_page=30&state=open`
  );
  if (ok && Array.isArray(data)) {
    return {
      available: true,
      items: data.map(p => ({
        id: p.id,
        name: p.name,
        body: p.body || null,
        url: p.html_url,
        state: p.state,
        updatedAt: p.updated_at,
        openIssuesCount: p.open_issues_count || 0
      }))
    };
  }
  return {
    available: false,
    reason: 'Requires a Personal Access Token (PAT) with read:project scope, or no public classic projects exist'
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async function main() {
  try {
    const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

    // 1. Fetch user repos
    console.log('Fetching user repositories…');
    const repos = await fetchUserRepos(USER);
    console.log(`  Found ${repos.length} active (non-archived) repos`);

    // 2. Fetch workflow runs for repos that appear to have Actions
    //    Limit to the 25 most-recently-pushed repos to manage API calls
    const reposToCheck = repos.slice(0, 25);
    let allRuns = [];
    // workflow key → { repo, workflow, runs, successCount, totalDurationMs }
    const workflowStats = new Map();

    console.log(`Fetching Actions workflow runs for up to ${reposToCheck.length} repos…`);
    for (const repo of reposToCheck) {
      const runs = await fetchWorkflowRuns(repo.full_name, since);
      if (runs.length === 0) continue;

      allRuns.push(...runs);

      for (const run of runs) {
        const key = `${repo.full_name}||${run.name}`;
        if (!workflowStats.has(key)) {
          workflowStats.set(key, {
            repo: repo.full_name,
            workflow: run.name,
            runs: 0,
            successCount: 0,
            totalDurationMs: 0
          });
        }
        const stats = workflowStats.get(key);
        stats.runs++;
        if (run.conclusion === 'success') stats.successCount++;
        if (run.run_started_at && run.updated_at) {
          const dur = new Date(run.updated_at) - new Date(run.run_started_at);
          if (dur > 0) stats.totalDurationMs += dur;
        }
      }
    }

    // Aggregate conclusion counts
    const byConclusion = {};
    let totalDurationMs = 0;
    for (const run of allRuns) {
      if (run.conclusion) {
        byConclusion[run.conclusion] = (byConclusion[run.conclusion] || 0) + 1;
      }
      if (run.status === 'completed' && run.run_started_at && run.updated_at) {
        const dur = new Date(run.updated_at) - new Date(run.run_started_at);
        if (dur > 0) totalDurationMs += dur;
      }
    }

    const topWorkflows = Array.from(workflowStats.values())
      .sort((a, b) => b.runs - a.runs)
      .slice(0, 10)
      .map(s => ({
        repo: s.repo,
        workflow: s.workflow,
        runs: s.runs,
        successRate: s.runs > 0 ? +(s.successCount / s.runs).toFixed(2) : 0,
        avgDurationSeconds: s.runs > 0 ? Math.round(s.totalDurationMs / s.runs / 1000) : 0
      }));

    const reposWithRuns = new Set(allRuns.map(r => r.repository?.full_name || '')).size;
    const actionsData = {
      available: true,
      reposChecked: reposToCheck.length,
      reposWithRuns,
      totalRuns: allRuns.length,
      byConclusion,
      estimatedComputeMinutes: Math.round(totalDurationMs / 60000),
      topWorkflows
    };

    console.log(`  Total workflow runs: ${allRuns.length}`);
    console.log(`  Estimated compute: ${actionsData.estimatedComputeMinutes} minutes`);

    // 3. Copilot individual subscription status
    console.log('Fetching Copilot subscription status…');
    const copilotSubscription = await fetchCopilotStatus();
    console.log(`  Copilot available: ${copilotSubscription.available}`);

    // 4. Copilot org-level metrics (requires manage_billing:copilot)
    console.log('Fetching Copilot org metrics…');
    const copilotOrgMetrics = await fetchCopilotOrgMetrics(USER);
    console.log(`  Copilot org metrics available: ${copilotOrgMetrics.available}`);

    // 5. Codespaces
    console.log('Fetching Codespaces…');
    const codespacesData = await fetchCodespaces();
    console.log(`  Codespaces available: ${codespacesData.available}`);

    // 6. Projects
    console.log('Fetching Projects…');
    const projectsData = await fetchProjects(USER);
    console.log(`  Projects available: ${projectsData.available}`);

    // Build output
    const output = {
      generated: new Date().toISOString(),
      user: USER,
      period: {
        days: DAYS,
        start: since.toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      },
      actions: actionsData,
      copilot: {
        subscription: copilotSubscription,
        orgMetrics: copilotOrgMetrics
      },
      codespaces: codespacesData,
      projects: projectsData
    };

    const outputPath = `${dataDir}/usage.json`;
    writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\nUsage data written to ${outputPath}`);

  } catch (err) {
    console.error('Failed:', err?.message || err);
    process.exit(2);
  }
})();
