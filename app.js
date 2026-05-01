// GitHub Activity Summary - Client-side Application

// Configuration
const API_BASE = 'https://api.github.com';
const DATA_DIR = '_data';

// State
let cachedActivity = null;
let metadata = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    await loadDefaultUserData();
    setupQueryForm();
    checkUrlParameters();
});

// Load cached data for default user
async function loadDefaultUserData() {
    try {
        // Load activity data
        const activityResponse = await fetch(`${DATA_DIR}/activity.json`);
        if (!activityResponse.ok) {
            throw new Error('Failed to load cached activity data');
        }
        cachedActivity = await activityResponse.json();
        
        // Load metadata
        const metadataResponse = await fetch(`${DATA_DIR}/metadata.json`);
        if (metadataResponse.ok) {
            metadata = await metadataResponse.json();
        }
        
        // Display the data
        displayDefaultUserActivity();
    } catch (error) {
        console.warn('Default user data not available:', error?.message || error);
        // Hide the default user section since we don't have data
        document.getElementById('default-user-section').style.display = 'none';
        
        // Show error in system messages at the bottom
        const systemMessages = document.getElementById('system-messages');
        const systemMessagesContent = document.getElementById('system-messages-content');
        systemMessages.classList.remove('hidden');
        systemMessagesContent.innerHTML = `
            <div class="error">
                <h4>Cached Data Not Available</h4>
                <p>The cached activity data has not been generated yet. You can still query any GitHub user using the form above.</p>
                <p class="small">Technical details: ${error.message}</p>
            </div>
        `;
    }
}

// Display default user activity
function displayDefaultUserActivity() {
    if (!cachedActivity) return;
    
    // Enable the Usage & AI nav link now that a user account is available
    const usageNavLink = document.getElementById('usage-nav-link');
    if (usageNavLink) {
        usageNavLink.classList.remove('disabled');
        usageNavLink.removeAttribute('aria-disabled');
        usageNavLink.removeAttribute('tabindex');
    }

    // Set username
    document.getElementById('default-username').textContent = cachedActivity.user;
    document.title = `GitHub Activity - ${cachedActivity.user}`;
    
    // Set metadata
    if (metadata) {
        const lastUpdate = new Date(metadata.lastUpdate);
        document.getElementById('last-update').innerHTML = `
            <strong>Last Updated:</strong> ${formatDateTime(lastUpdate)}
        `;
        if (metadata.nextScheduled) {
            document.getElementById('next-update').innerHTML = `
                <strong>Next Update:</strong> ${metadata.nextScheduled}
            `;
        }
    }
    
    // Display summary statistics
    displaySummaryStats(cachedActivity.summary, 'summary-stats');
    
    // Display charts
    displayActivityByType(cachedActivity.summary.activityByType, 'type-chart');
    displayTopRepositories(cachedActivity.summary.topRepositories, 'repo-chart');
    
    // Display daily timeline
    displayDailyTimeline(cachedActivity.dailyActivity);

    // Display open contributions info for top repos (async, non-blocking)
    displayOpenContributions(cachedActivity.summary.topRepositories, 'open-contributions');
}

// Display summary statistics
function displaySummaryStats(summary, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${summary.totalEvents}</div>
            <div class="stat-label">Total Events</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${summary.totalDaysWithActivity}</div>
            <div class="stat-label">Active Days</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${summary.averagePerDay}</div>
            <div class="stat-label">Avg Events/Day</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${summary.topRepositories.length}</div>
            <div class="stat-label">Repositories</div>
        </div>
    `;
}

// Display activity by type chart
function displayActivityByType(activityByType, containerId) {
    const container = document.getElementById(containerId);
    const maxCount = Math.max(...activityByType.map(item => item.count));
    
    container.innerHTML = activityByType.map(item => {
        const percentage = (item.count / maxCount * 100).toFixed(1);
        return `
            <div class="bar-item">
                <div class="bar-label">${escapeHtml(item.type)}</div>
                <div class="bar-container">
                    <div class="bar-fill" style="width: ${percentage}%"></div>
                    <div class="bar-value">${item.count}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Display top repositories chart
function displayTopRepositories(topRepos, containerId) {
    const container = document.getElementById(containerId);
    const maxCount = Math.max(...topRepos.map(item => item.count));
    
    container.innerHTML = topRepos.map(item => {
        const percentage = (item.count / maxCount * 100).toFixed(1);
        const repoDisplay = item.repo === 'private-repos' 
            ? '<em>Private Repositories (aggregated)</em>' 
            : escapeHtml(item.repo);
        return `
            <div class="bar-item">
                <div class="bar-label">${repoDisplay}</div>
                <div class="bar-container">
                    <div class="bar-fill" style="width: ${percentage}%"></div>
                    <div class="bar-value">${item.count}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Display daily timeline
function displayDailyTimeline(dailyActivity, containerId = 'daily-timeline') {
    const container = document.getElementById(containerId);
    
    if (dailyActivity.length === 0) {
        container.innerHTML = '<p class="no-data">No activity in this period</p>';
        return;
    }
    
    container.innerHTML = dailyActivity.map(day => {
        const topTypes = Object.entries(day.byType)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([type, count]) => `${count} ${type}`)
            .join(', ');
        
        const topRepos = Object.entries(day.byRepo)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([repo]) => repo)
            .join(', ');
        
        return `
            <div class="timeline-day">
                <div class="timeline-date">${escapeHtml(formatDateWithDayOfWeek(day.date))}</div>
                <div class="timeline-content">
                    <div class="timeline-stat">
                        <strong>${day.total}</strong> events: ${escapeHtml(topTypes)}
                    </div>
                    ${topRepos ? `<div class="timeline-repos">Repositories: ${escapeHtml(topRepos)}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Setup query form for other users
function setupQueryForm() {
    const form = document.getElementById('query-form');
    
    // Set default date values
    const toDateInput = document.getElementById('query-date-to');
    const fromDateInput = document.getElementById('query-date-from');
    
    // Set "to" date as today
    toDateInput.value = new Date().toISOString().split('T')[0];
    
    // Set "from" date as 14 days ago
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    fromDateInput.value = fourteenDaysAgo.toISOString().split('T')[0];
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('query-username').value.trim();
        const fromDate = fromDateInput.value;
        const toDate = toDateInput.value;
        
        if (username) {
            // Update URL with username and date range parameters
            const url = new URL(window.location);
            url.searchParams.set('u', username);
            if (fromDate) url.searchParams.set('from', fromDate);
            if (toDate) url.searchParams.set('to', toDate);
            window.history.pushState({}, '', url);

            await queryUser(username, fromDate, toDate);
        }
    });
}

// Check URL parameters on page load
function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('u');
    
    if (username && username.trim()) {
        // Hide the default user section when viewing another user
        document.getElementById('default-user-section').style.display = 'none';
        
        // Set the username in the input field
        document.getElementById('query-username').value = username.trim();
        
        // Override date inputs if URL params are present
        const fromParam = urlParams.get('from');
        const toParam = urlParams.get('to');
        if (fromParam) document.getElementById('query-date-from').value = fromParam;
        if (toParam) document.getElementById('query-date-to').value = toParam;
        
        // Get date values (from URL params or form defaults)
        const fromDate = document.getElementById('query-date-from').value;
        const toDate = document.getElementById('query-date-to').value;
        
        // Query the user
        queryUser(username.trim(), fromDate, toDate);
    }
}

// Query another user's public activity
async function queryUser(username, fromDate, toDate) {
    const resultsSection = document.getElementById('query-results');
    const loadingDiv = document.getElementById('query-loading');
    const errorDiv = document.getElementById('query-error');
    const summaryDiv = document.getElementById('query-summary');
    const detailsDiv = document.getElementById('query-details');
    
    // Show results section and loading state
    resultsSection.classList.remove('hidden');
    loadingDiv.classList.remove('hidden');
    errorDiv.classList.add('hidden');
    summaryDiv.innerHTML = '';
    detailsDiv.innerHTML = '';
    document.getElementById('queried-username').textContent = username;
    
    try {
        // Parse dates and calculate days
        // Use parseDateLocal to treat YYYY-MM-DD strings as local midnight, avoiding
        // the off-by-one display issue caused by new Date('YYYY-MM-DD') parsing as UTC.
        const startDate = (fromDate && parseDateLocal(fromDate)) || new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const endDate = (toDate && parseDateLocal(toDate)) || new Date();
        
        // Set end date to end of day
        endDate.setHours(23, 59, 59, 999);
        
        // Calculate number of days
        const daysDiff = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));

        // Progressive callback: show results as soon as the first page with matches arrives
        let partialShown = false;
        function onPageFetched(partialEvents, pageNum, totalEventsFetched) {
            const loadingMsg = loadingDiv.querySelector('p');
            if (partialEvents.length > 0) {
                if (!partialShown) {
                    partialShown = true;
                    // Render partial results immediately while more pages load
                    const partial = processEventsForDisplay(partialEvents, username, daysDiff);
                    displaySummaryStats(partial.summary, 'query-summary');
                    detailsDiv.innerHTML = buildDetailsHtml(startDate, endDate, daysDiff, totalEventsFetched, pageNum, partialEvents.length, true);
                    displayActivityByType(partial.summary.activityByType, 'query-type-chart');
                    displayTopRepositories(partial.summary.topRepositories, 'query-repo-chart');
                    displayDailyTimeline(partial.dailyActivity, 'query-daily-timeline');
                }
                if (loadingMsg) loadingMsg.textContent = `Fetching activity data… (page ${pageNum} done, ${partialEvents.length} events so far)`;
            } else {
                if (loadingMsg) loadingMsg.textContent = `Fetching activity data… (page ${pageNum} done)`;
            }
        }
        
        // Fetch public events for the user
        const { events, totalFetched, pagesUsed, atLimit } = await fetchPublicEvents(username, startDate, endDate, onPageFetched);
        
        // Hide loading
        loadingDiv.classList.add('hidden');
        
        if (events.length === 0) {
            if (atLimit) {
                summaryDiv.innerHTML = `
                    <p class="no-data">Activity data not available for ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()} via the GitHub API.</p>
                    <p class="debug-info">Fetched ${totalFetched} event(s) across ${pagesUsed} page(s) from the GitHub API. <strong>Note:</strong> The GitHub public events API only returns the ~300 most recent events. The requested date range is older than what the API can provide — activity may well exist in this period but cannot be retrieved this way.</p>
                `;
            } else {
                summaryDiv.innerHTML = `
                    <p class="no-data">No public activity found from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}.</p>
                    <p class="debug-info">Fetched ${totalFetched} event(s) across ${pagesUsed} page(s) from the GitHub API.</p>
                `;
            }
            detailsDiv.innerHTML = '';
            return;
        }
        
        // Process events and render final (complete) results
        const processedData = processEventsForDisplay(events, username, daysDiff);
        
        // Display summary
        displaySummaryStats(processedData.summary, 'query-summary');
        
        // Display details
        detailsDiv.innerHTML = buildDetailsHtml(startDate, endDate, daysDiff, totalFetched, pagesUsed, events.length, false, atLimit);
        
        displayActivityByType(processedData.summary.activityByType, 'query-type-chart');
        displayTopRepositories(processedData.summary.topRepositories, 'query-repo-chart');
        displayDailyTimeline(processedData.dailyActivity, 'query-daily-timeline');

        // Display open contributions info for top repos (async, non-blocking)
        displayOpenContributions(processedData.summary.topRepositories, 'query-open-contributions');
        
    } catch (error) {
        loadingDiv.classList.add('hidden');
        errorDiv.classList.remove('hidden');
        errorDiv.textContent = `Error: ${error.message}`;
        console.error('Error querying user:', error);
    }
}

// Build the details section HTML
function buildDetailsHtml(startDate, endDate, daysDiff, totalFetched, pagesUsed, matchedCount, isPartial, atLimit = false) {
    const partialNote = isPartial ? ' <em>(loading more…)</em>' : '';
    const limitBanner = atLimit ? `
        <div class="limit-warning">
            <strong>⚠️ GitHub API limit reached:</strong> The GitHub public events API only returns your ~300 most recent public events.
            Results shown cover part of the requested range but <strong>earlier activity (before approximately ${startDate.toLocaleDateString()}) could not be retrieved</strong> — not because nothing happened, but because older events are no longer available via this API.
            To see earlier activity, try a shorter or more recent date range.
        </div>` : '';
    return `
        <div class="date-range-info">
            <p><strong>Date Range:</strong> ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()} (${daysDiff} days)</p>
            <p class="debug-info">Fetched ${totalFetched} event(s) across ${pagesUsed} page(s); ${matchedCount} matched the date range.${partialNote}</p>
            ${limitBanner}
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

// Fetch public events from GitHub API
async function fetchPublicEvents(username, startDate, endDate, onPageFetched = null) {
    const perPage = 100;
    let allEvents = [];
    let page = 1;
    const maxPages = 10; // GitHub public events API supports at most 300 events (3 pages of 100); extra pages return 422
    let hitApiLimit = false; // true when GitHub returns 422, meaning we've exhausted available history
    
    console.debug(`[gh-summary] Fetching events for ${username}, range: ${startDate.toISOString()} → ${endDate.toISOString()}`);
    
    while (page <= maxPages) {
        const url = `${API_BASE}/users/${encodeURIComponent(username)}/events/public?per_page=${perPage}&page=${page}`;
        
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'gh-summary-pages'
            }
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('User not found');
            }
            // GitHub returns 422 when requesting beyond the available pages limit
            if (response.status === 422) {
                console.debug(`[gh-summary] Page ${page}: GitHub returned 422 (beyond available pages), stopping`);
                hitApiLimit = true;
                break;
            }
            throw new Error(`GitHub API error: ${response.status}`);
        }
        
        const events = await response.json();
        if (!Array.isArray(events) || events.length === 0) {
            console.debug(`[gh-summary] Page ${page}: no more events`);
            break;
        }
        
        const oldest = events[events.length - 1];
        console.debug(`[gh-summary] Page ${page}: ${events.length} events, newest: ${events[0].created_at}, oldest: ${oldest.created_at}`);
        allEvents.push(...events);

        // Notify caller with partial results after each page
        if (onPageFetched) {
            const partialFiltered = allEvents.filter(e => {
                const eventDate = new Date(e.created_at);
                return eventDate >= startDate && eventDate <= endDate;
            });
            onPageFetched(partialFiltered, page, allEvents.length);
        }
        
        // Stop if oldest event on this page is already before our start date
        if (oldest && new Date(oldest.created_at) < startDate) {
            console.debug(`[gh-summary] Oldest event predates startDate – stopping pagination`);
            break;
        }
        
        page++;
    }
    
    // Filter events within date range
    const filtered = allEvents.filter(e => {
        const eventDate = new Date(e.created_at);
        return eventDate >= startDate && eventDate <= endDate;
    });
    
    console.debug(`[gh-summary] Total fetched: ${allEvents.length} (${page - 1} page(s)), matched date range: ${filtered.length}`);
    
    // atLimit is true when we hit the API hard limit (422) before finding events old enough
    // to cover the start of the requested date range. This means activity may exist in that
    // period but the GitHub public events API only returns the ~300 most recent events.
    // GitHub API guarantees the created_at field on all event objects.
    const oldestFetched = allEvents.length > 0 ? new Date(allEvents[allEvents.length - 1].created_at) : null;
    const reachedPaginationEnd = hitApiLimit || page > maxPages;
    const atLimit = reachedPaginationEnd && (oldestFetched === null || oldestFetched > startDate);
    
    return { events: filtered, totalFetched: allEvents.length, pagesUsed: page - 1, atLimit };
}

// Process events for display
function processEventsForDisplay(events, username, days) {
    const repoStats = new Map();
    const typeStats = new Map();
    const dailyMap = new Map();
    
    for (const e of events) {
        const type = classifyEvent(e);
        const repo = e.repo?.name || 'unknown';
        // Use local-timezone date components so events are grouped by the user's
        // local date rather than UTC (avoids showing future-dated activity for
        // users in negative UTC offsets like ET).
        const eventDate = new Date(e.created_at);
        const date = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
        
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
    
    // Sort daily activity newest-first
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
            activityByType: topTypes
        }
    };
}

// Classify event types
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

// ── Open Contributions Descriptor support ─────────────────────────────────────

// Only allow http/https URLs to prevent javascript: protocol injection
function safeUrl(url) {
    try {
        const u = new URL(url);
        return (u.protocol === 'http:' || u.protocol === 'https:') ? url : '#';
    } catch {
        return '#';
    }
}

// Fetch .well-known/open-contributions.json from a GitHub repository
async function fetchOpenContributions(repoFullName) {
    const parts = repoFullName.split('/');
    if (parts.length !== 2) return null;
    const [owner, repo] = parts;
    const url = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/HEAD/.well-known/open-contributions.json`;
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'gh-summary-pages' }
        });
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

// Render a single open-contributions card for a repository
function renderOpenContributionCard(repoFullName, data) {
    const repoName = repoFullName.split('/')[1];
    // Try to find a matching project entry by repo URL or name
    const project = Array.isArray(data.projects)
        ? (data.projects.find(p => p.repository?.url?.includes(repoFullName)) ||
           data.projects.find(p => p.name === repoName) ||
           data.projects[0])
        : null;
    const org = data.organization;

    const lines = [];
    if (org?.description) {
        lines.push(`<p class="open-contrib-org">${escapeHtml(org.description)}</p>`);
    }
    if (project?.description) {
        lines.push(`<p>${escapeHtml(project.description)}</p>`);
    }
    if (project?.status) {
        lines.push(`<span class="status-badge status-${escapeHtml(project.status)}">${escapeHtml(project.status)}</span>`);
    }

    const links = [];
    if (project?.participate?.issues) {
        links.push(`<a href="${escapeHtml(safeUrl(project.participate.issues))}" target="_blank" rel="noopener noreferrer">Issues</a>`);
    }
    if (project?.participate?.good_first_issues) {
        links.push(`<a href="${escapeHtml(safeUrl(project.participate.good_first_issues))}" target="_blank" rel="noopener noreferrer">Good First Issues</a>`);
    }
    if (project?.release?.security_policy) {
        links.push(`<a href="${escapeHtml(safeUrl(project.release.security_policy))}" target="_blank" rel="noopener noreferrer">Security Policy</a>`);
    }
    if (links.length > 0) {
        lines.push(`<div class="open-contrib-links">${links.join(' · ')}</div>`);
    }

    return `
        <div class="open-contrib-card">
            <h4>${escapeHtml(repoFullName)}</h4>
            ${lines.join('\n            ')}
        </div>
    `;
}

// Display open contributions info for up to the top 5 repositories
async function displayOpenContributions(topRepos, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Only check repos with a valid owner/name pair (skip "private-repos" placeholder)
    const reposToCheck = topRepos
        .slice(0, 5)
        .filter(r => r.repo && r.repo !== 'private-repos' && r.repo.includes('/'));

    if (reposToCheck.length === 0) return;

    // Fetch all descriptors in parallel
    const results = await Promise.all(
        reposToCheck.map(async r => ({ repo: r.repo, data: await fetchOpenContributions(r.repo) }))
    );

    const found = results.filter(r => r.data !== null);
    if (found.length === 0) return;

    container.classList.remove('hidden');
    container.innerHTML = `
        <h3>Open Contributions Info</h3>
        <p class="info-text">
            The following repositories publish an
            <a href="https://www.foo.be/2026/03/open-contributions-descriptor" target="_blank" rel="noopener noreferrer">Open Contributions Descriptor</a>
            describing how you can get involved.
        </p>
        ${found.map(r => renderOpenContributionCard(r.repo, r.data)).join('')}
    `;
}

// ── Utility functions ──────────────────────────────────────────────────────────

// Parse a YYYY-MM-DD string as local midnight to avoid the off-by-one timezone
// issue that occurs when new Date('YYYY-MM-DD') is treated as UTC midnight and
// then displayed with toLocaleDateString() in a negative-offset timezone.
function parseDateLocal(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    const [year, month, day] = parts;
    return new Date(year, month - 1, day);
}

function formatDateWithDayOfWeek(dateStr) {
    // Parse YYYY-MM-DD in local time to avoid timezone-shift issues
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat('en-GB', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    }).format(date);
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
    div.textContent = text;
    return div.innerHTML;
}
