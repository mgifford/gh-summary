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
        console.error('Error loading default user data:', error);
        document.getElementById('default-user-section').innerHTML = `
            <div class="error">
                <h3>Data Not Available</h3>
                <p>Cached activity data has not been generated yet. Please check back later.</p>
                <p class="small">Error: ${error.message}</p>
            </div>
        `;
    }
}

// Display default user activity
function displayDefaultUserActivity() {
    if (!cachedActivity) return;
    
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
function displayDailyTimeline(dailyActivity) {
    const container = document.getElementById('daily-timeline');
    
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
                <div class="timeline-date">${escapeHtml(day.date)}</div>
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
    
    // Set "from" date as 31 days ago
    const thirtyOneDaysAgo = new Date();
    thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
    fromDateInput.value = thirtyOneDaysAgo.toISOString().split('T')[0];
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('query-username').value.trim();
        const fromDate = fromDateInput.value;
        const toDate = toDateInput.value;
        
        if (username) {
            await queryUser(username, fromDate, toDate);
            // Update URL with the username parameter
            updateUrlParameter('u', username);
        }
    });
}

// Check URL parameters on page load
function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('u');
    
    if (username && username.trim()) {
        // Set the username in the input field
        document.getElementById('query-username').value = username.trim();
        
        // Get date values from the form (which have been set to defaults)
        const fromDate = document.getElementById('query-date-from').value;
        const toDate = document.getElementById('query-date-to').value;
        
        // Query the user
        queryUser(username.trim(), fromDate, toDate);
    }
}

// Update URL parameter without reloading the page
function updateUrlParameter(key, value) {
    const url = new URL(window.location);
    url.searchParams.set(key, value);
    window.history.pushState({}, '', url);
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
        const startDate = fromDate ? new Date(fromDate) : new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
        const endDate = toDate ? new Date(toDate) : new Date();
        
        // Set end date to end of day
        endDate.setHours(23, 59, 59, 999);
        
        // Calculate number of days
        const daysDiff = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));
        
        // Fetch public events for the user
        const events = await fetchPublicEvents(username, startDate, endDate);
        
        // Hide loading
        loadingDiv.classList.add('hidden');
        
        if (events.length === 0) {
            summaryDiv.innerHTML = `<p class="no-data">No public activity found from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}</p>`;
            return;
        }
        
        // Process events
        const processedData = processEventsForDisplay(events, username, daysDiff);
        
        // Display summary
        displaySummaryStats(processedData.summary, 'query-summary');
        
        // Display details
        detailsDiv.innerHTML = `
            <div class="date-range-info">
                <p><strong>Date Range:</strong> ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()} (${daysDiff} days)</p>
            </div>
            <div class="chart-section">
                <h4>Activity by Type</h4>
                <div id="query-type-chart" class="chart"></div>
            </div>
            <div class="chart-section">
                <h4>Top Repositories</h4>
                <div id="query-repo-chart" class="chart"></div>
            </div>
        `;
        
        displayActivityByType(processedData.summary.activityByType, 'query-type-chart');
        displayTopRepositories(processedData.summary.topRepositories, 'query-repo-chart');
        
    } catch (error) {
        loadingDiv.classList.add('hidden');
        errorDiv.classList.remove('hidden');
        errorDiv.textContent = `Error: ${error.message}`;
        console.error('Error querying user:', error);
    }
}

// Fetch public events from GitHub API
async function fetchPublicEvents(username, startDate, endDate) {
    const perPage = 100;
    let allEvents = [];
    let page = 1;
    
    while (page <= 3) { // Limit to 3 pages for performance
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
            throw new Error(`GitHub API error: ${response.status}`);
        }
        
        const events = await response.json();
        if (!Array.isArray(events) || events.length === 0) break;
        
        allEvents.push(...events);
        
        // Check if oldest event is beyond our date range
        const oldestEvent = events[events.length - 1];
        if (oldestEvent && new Date(oldestEvent.created_at) < startDate) break;
        
        page++;
    }
    
    // Filter events within date range
    return allEvents.filter(e => {
        const eventDate = new Date(e.created_at);
        return eventDate >= startDate && eventDate <= endDate;
    });
}

// Process events for display
function processEventsForDisplay(events, username, days) {
    const repoStats = new Map();
    const typeStats = new Map();
    
    for (const e of events) {
        const type = classifyEvent(e);
        const repo = e.repo?.name || 'unknown';
        
        repoStats.set(repo, (repoStats.get(repo) || 0) + 1);
        typeStats.set(type, (typeStats.get(type) || 0) + 1);
    }
    
    const topRepos = Array.from(repoStats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([repo, count]) => ({ repo, count }));
    
    const topTypes = Array.from(typeStats.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ type, count }));
    
    return {
        user: username,
        summary: {
            totalEvents: events.length,
            totalDaysWithActivity: new Set(events.map(e => new Date(e.created_at).toDateString())).size,
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

// Utility functions
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
