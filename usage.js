// GitHub Usage Summary - Client-side Application

const DATA_DIR = '_data';

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    await loadUsageData();
});

// Load cached usage data
async function loadUsageData() {
    try {
        console.debug('[gh-summary/usage] Fetching _data/usage.json…');
        const response = await fetch(`${DATA_DIR}/usage.json`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} loading _data/usage.json`);
        }
        const data = await response.json();
        console.debug(`[gh-summary/usage] Loaded usage.json: user=${data.user} generated=${data.generated}`);
        renderUsagePage(data);
    } catch (error) {
        console.warn('[gh-summary/usage] Usage data not available:', error?.message || error);
        console.info(
            '[gh-summary/usage] To generate usage data, run:\n' +
            '  export GITHUB_TOKEN=<your-PAT>  # or add GH_PAT secret in repo settings\n' +
            '  node generate-usage.mjs\n' +
            'See API-LIMITATIONS.md for required token scopes.'
        );
        const main = document.getElementById('usage-main');
        main.innerHTML = `
            <div class="error">
                <h3>No User Account Configured</h3>
                <p>Usage &amp; AI data is only available once a default user account has been set up and cached data has been generated.</p>
                <p>Please <a href="index.html">return to the Activity page</a> and configure a user account first, then run <code>node generate-usage.mjs</code> to generate the usage data.</p>
                <p>See <a href="API-LIMITATIONS.md">API-LIMITATIONS.md</a> for details on required GitHub token scopes.</p>
                <p class="small">Technical details: ${escapeHtml(error.message)}</p>
            </div>
        `;
    }
}

function renderUsagePage(data) {
    // Header metadata
    document.getElementById('usage-username').textContent = data.user;
    document.title = `GitHub Usage - ${data.user}`;

    const generated = new Date(data.generated);
    document.getElementById('usage-generated').innerHTML =
        `<strong>Data generated:</strong> ${formatDateTime(generated)}`;

    document.getElementById('usage-period').innerHTML =
        `<strong>Period:</strong> ${data.period.start} to ${data.period.end} (${data.period.days} days)`;

    // Log diagnostic summary for each section
    logSectionDiagnostics(data);

    // Render each section
    renderActionsSection(data.actions);
    renderCopilotSection(data.copilot);
    renderCodespacesSection(data.codespaces);
    renderProjectsSection(data.projects);
}

// Log diagnostic information about what data is available and what is missing
function logSectionDiagnostics(data) {
    const prefix = '[gh-summary/usage]';
    let allAvailable = true;

    // Actions
    if (data.actions?.available) {
        console.debug(`${prefix} actions: available — ${data.actions.totalRuns} run(s) across ${data.actions.reposChecked} repo(s)`);
    } else {
        allAvailable = false;
        console.info(`${prefix} actions unavailable: ${data.actions?.reason || 'no data'}`);
    }

    // Copilot subscription
    if (data.copilot?.subscription?.available) {
        console.debug(`${prefix} copilot.subscription: available — plan=${data.copilot.subscription.planType}`);
    } else {
        allAvailable = false;
        console.info(`${prefix} copilot.subscription unavailable: ${data.copilot?.subscription?.reason || 'no data'}`);
    }

    // Copilot org metrics
    if (data.copilot?.orgMetrics?.available) {
        console.debug(`${prefix} copilot.orgMetrics: available — ${data.copilot.orgMetrics.orgs?.length || 0} org(s)`);
    } else {
        allAvailable = false;
        console.info(`${prefix} copilot.orgMetrics unavailable: ${data.copilot?.orgMetrics?.reason || 'no data'}`);
    }

    // Codespaces
    if (data.codespaces?.available) {
        console.debug(`${prefix} codespaces: available — ${data.codespaces.totalCount} item(s)`);
    } else {
        allAvailable = false;
        console.info(`${prefix} codespaces unavailable: ${data.codespaces?.reason || 'no data'}`);
    }

    // Projects
    if (data.projects?.available) {
        console.debug(`${prefix} projects: available — ${data.projects.items?.length || 0} item(s)`);
    } else {
        allAvailable = false;
        console.info(`${prefix} projects unavailable: ${data.projects?.reason || 'no data'}`);
    }

    if (!allAvailable) {
        console.info(
            `${prefix} Tip: some sections are empty because the GITHUB_TOKEN used to generate\n` +
            `  _data/usage.json lacked the required OAuth scopes.\n` +
            `  See API-LIMITATIONS.md for the list of required scopes and setup instructions.`
        );
    }
}

// ── Actions Section ────────────────────────────────────────────────────────────

function renderActionsSection(actions) {
    const container = document.getElementById('actions-content');

    if (!actions || !actions.available) {
        container.innerHTML = unavailableNote(actions?.reason);
        return;
    }

    const successCount = actions.byConclusion?.success || 0;
    const failureCount = actions.byConclusion?.failure || 0;
    const cancelledCount = actions.byConclusion?.cancelled || 0;
    const skippedCount = actions.byConclusion?.skipped || 0;
    const successRate = actions.totalRuns > 0
        ? ((successCount / actions.totalRuns) * 100).toFixed(1)
        : '—';

    // Summary stats
    const statsHtml = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${actions.totalRuns}</div>
                <div class="stat-label">Total Runs</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${actions.reposWithRuns}</div>
                <div class="stat-label">Repos with Runs</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${successRate}%</div>
                <div class="stat-label">Success Rate</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${actions.estimatedComputeMinutes}</div>
                <div class="stat-label">Compute Minutes</div>
            </div>
        </div>
    `;

    // Conclusion breakdown bar chart
    let conclusionHtml = '';
    if (actions.totalRuns > 0) {
        const conclusions = [
            { label: 'Success', count: successCount, cls: 'bar-success' },
            { label: 'Failure', count: failureCount, cls: 'bar-failure' },
            { label: 'Cancelled', count: cancelledCount, cls: 'bar-cancelled' },
            { label: 'Skipped', count: skippedCount, cls: 'bar-skipped' }
        ].filter(c => c.count > 0);

        const maxCount = Math.max(...conclusions.map(c => c.count));
        conclusionHtml = `
            <div class="chart-section">
                <h3>Run Results</h3>
                <div class="chart">
                    ${conclusions.map(c => `
                        <div class="bar-item">
                            <div class="bar-label">${escapeHtml(c.label)}</div>
                            <div class="bar-container">
                                <div class="bar-fill ${c.cls}" style="width: ${(c.count / maxCount * 100).toFixed(1)}%"></div>
                                <div class="bar-value">${c.count}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Top workflows table
    let workflowsHtml = '';
    if (Array.isArray(actions.topWorkflows) && actions.topWorkflows.length > 0) {
        const rows = actions.topWorkflows.map(w => `
            <tr>
                <td>${escapeHtml(w.repo)}</td>
                <td>${escapeHtml(w.workflow)}</td>
                <td>${w.runs}</td>
                <td>${(w.successRate * 100).toFixed(0)}%</td>
                <td>${formatDuration(w.avgDurationSeconds)}</td>
            </tr>
        `).join('');

        workflowsHtml = `
            <div class="chart-section">
                <h3>Top Workflows</h3>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Repository</th>
                                <th>Workflow</th>
                                <th>Runs</th>
                                <th>Success Rate</th>
                                <th>Avg Duration</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // Energy context note
    const energyNote = actions.estimatedComputeMinutes > 0 ? `
        <div class="info-box">
            <h4>⚡ Compute & Energy Context</h4>
            <p>
                An estimated <strong>${actions.estimatedComputeMinutes} compute minutes</strong> were used by
                GitHub Actions over this period. GitHub runs Actions on cloud infrastructure and publishes
                sustainability information in its annual
                <a href="https://github.blog/tag/sustainability/" target="_blank" rel="noopener noreferrer">sustainability reports</a>.
                Per-workflow energy data is not currently available via the GitHub API.
            </p>
        </div>
    ` : '';

    container.innerHTML = statsHtml + conclusionHtml + workflowsHtml + energyNote;
}

// ── Copilot Section ────────────────────────────────────────────────────────────

function renderCopilotSection(copilot) {
    const container = document.getElementById('copilot-content');

    if (!copilot) {
        container.innerHTML = unavailableNote('No Copilot data in usage.json');
        return;
    }

    const { subscription, orgMetrics } = copilot;

    // Individual subscription card
    let subscriptionHtml = '';
    if (subscription?.available) {
        const lastActivity = subscription.lastActivityAt
            ? new Date(subscription.lastActivityAt).toLocaleDateString()
            : 'N/A';
        subscriptionHtml = `
            <div class="info-card">
                <h3>Copilot Subscription</h3>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">✅</div>
                        <div class="stat-label">Active</div>
                    </div>
                    ${subscription.planType ? `
                    <div class="stat-card">
                        <div class="stat-value">${escapeHtml(subscription.planType)}</div>
                        <div class="stat-label">Plan</div>
                    </div>` : ''}
                    <div class="stat-card">
                        <div class="stat-value">${lastActivity}</div>
                        <div class="stat-label">Last Activity</div>
                    </div>
                    ${subscription.lastActivityEditor ? `
                    <div class="stat-card">
                        <div class="stat-value small-text">${escapeHtml(subscription.lastActivityEditor)}</div>
                        <div class="stat-label">Last Editor</div>
                    </div>` : ''}
                </div>
            </div>
        `;
    } else {
        subscriptionHtml = `
            <div class="info-card">
                <h3>Copilot Subscription</h3>
                ${unavailableNote(subscription?.reason)}
            </div>
        `;
    }

    // Org metrics card
    let orgMetricsHtml = '';
    if (orgMetrics?.available && Array.isArray(orgMetrics.orgs) && orgMetrics.orgs.length > 0) {
        const rows = orgMetrics.orgs.map(o => `
            <tr>
                <td>${escapeHtml(o.org)}</td>
                <td>${o.totalActiveUsers ?? '—'}</td>
                <td>${o.totalEngagedUsers ?? '—'}</td>
                <td>${o.date ? escapeHtml(o.date) : '—'}</td>
            </tr>
        `).join('');

        orgMetricsHtml = `
            <div class="info-card">
                <h3>Organisation Copilot Metrics</h3>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Organisation</th>
                                <th>Active Users</th>
                                <th>Engaged Users</th>
                                <th>As of</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `;
    } else {
        orgMetricsHtml = `
            <div class="info-card">
                <h3>Organisation Copilot Metrics</h3>
                ${unavailableNote(orgMetrics?.reason || 'Not available')}
            </div>
        `;
    }

    // AI energy context
    const aiNote = `
        <div class="info-box">
            <h4>🤖 AI Usage & Energy Context</h4>
            <p>
                Per-request energy data for AI features (Copilot completions, chat, agents) is not currently
                exposed via the GitHub API. Detailed Copilot usage metrics (suggestions accepted, chat turns, etc.)
                require <strong>organisation admin</strong> access with the
                <code>manage_billing:copilot</code> token scope.
                GitHub is working on improved transparency; see the
                <a href="https://resources.github.com/copilot-trust-center/" target="_blank" rel="noopener noreferrer">Copilot Trust Center</a>
                for current information.
            </p>
        </div>
    `;

    container.innerHTML = subscriptionHtml + orgMetricsHtml + aiNote;
}

// ── Codespaces Section ─────────────────────────────────────────────────────────

function renderCodespacesSection(codespaces) {
    const container = document.getElementById('codespaces-content');

    if (!codespaces || !codespaces.available) {
        container.innerHTML = unavailableNote(codespaces?.reason);
        return;
    }

    const items = Array.isArray(codespaces.items) ? codespaces.items : [];

    const statsHtml = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${codespaces.totalCount}</div>
                <div class="stat-label">Total Codespaces</div>
            </div>
        </div>
    `;

    let listHtml = '';
    if (items.length > 0) {
        const rows = items.map(cs => `
            <tr>
                <td>${escapeHtml(cs.displayName || cs.name)}</td>
                <td>${cs.repository ? escapeHtml(cs.repository) : '—'}</td>
                <td><span class="status-badge status-${escapeHtml(cs.state || 'unknown')}">${escapeHtml(cs.state || 'unknown')}</span></td>
                <td>${cs.machineDisplayName ? escapeHtml(cs.machineDisplayName) : '—'}</td>
                <td>${cs.lastUsedAt ? new Date(cs.lastUsedAt).toLocaleDateString() : '—'}</td>
            </tr>
        `).join('');

        listHtml = `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Repository</th>
                            <th>State</th>
                            <th>Machine</th>
                            <th>Last Used</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    } else {
        listHtml = '<p class="no-data">No Codespaces found.</p>';
    }

    container.innerHTML = statsHtml + listHtml;
}

// ── Projects Section ───────────────────────────────────────────────────────────

function renderProjectsSection(projects) {
    const container = document.getElementById('projects-content');

    if (!projects || !projects.available) {
        container.innerHTML = unavailableNote(projects?.reason);
        return;
    }

    const items = Array.isArray(projects.items) ? projects.items : [];

    if (items.length === 0) {
        container.innerHTML = '<p class="no-data">No open Projects found.</p>';
        return;
    }

    const cards = items.map(p => `
        <div class="project-card">
            <h4><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.name)}</a></h4>
            ${p.body ? `<p>${escapeHtml(p.body)}</p>` : ''}
            <div class="project-meta">
                <span class="status-badge status-${escapeHtml(p.state)}">${escapeHtml(p.state)}</span>
                ${p.openIssuesCount > 0 ? `<span>${p.openIssuesCount} open items</span>` : ''}
                <span>Updated ${new Date(p.updatedAt).toLocaleDateString()}</span>
            </div>
        </div>
    `).join('');

    container.innerHTML = `<div class="projects-list">${cards}</div>`;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function unavailableNote(reason) {
    const msg = reason || 'Data not available';
    return `<p class="unavailable-note">ℹ️ ${escapeHtml(msg)}</p>`;
}

function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '—';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatDateTime(date) {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    }).format(date);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}
