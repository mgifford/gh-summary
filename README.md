# GitHub Activity Summarizer

A Node.js tool to fetch and summarize your (or any user's) GitHub activity. Available as both a command-line interface (CLI) and a GitHub Pages web application.

## Features

### Web Interface (GitHub Pages)
- **Automated scheduled reports**: Generates activity summaries on the 15th and last day of each month
- **Default user tracking**: Automatically tracks and caches activity for a configured user
- **Privacy-respecting**: Only shares aggregated statistics, never private repository details
- **Query any user**: Enter any GitHub username to view their public activity in real-time
- **Visual dashboards**: Charts and statistics for activity types, repositories, and daily timelines

### CLI Tools
- Summarize GitHub activity by day
- Group by repository and event type
- Show either **counts** or **detailed event lists**
- Supports commits, issues, pull requests, reviews, discussions, wiki edits, releases, and more
- Filter output to only certain event types (`--include`)
- Works with public activity out-of-the-box; add a GitHub token to include private events
- Organization summaries with team member activity

## GitHub Pages Setup

### Prerequisites
- Node.js 18 or newer (for native `fetch`)
- A GitHub repository with Pages enabled
- Optional: a [GitHub Personal Access Token](https://github.com/settings/tokens) for private event statistics

### Configuration

Edit `config.yml` to customize your setup:

```yaml
# Default user whose activity will be tracked and cached
default_user: mgifford

# Schedule configuration
schedule:
  # Options: 'bimonthly' (15th and last day) or 'monthly' (last day only)
  frequency: bimonthly
  timezone: America/Toronto

# Activity tracking settings
activity:
  days: 31
  include_private_stats: true  # Aggregated stats only, no details
  include_types: []  # Empty = all types

# Privacy settings
privacy:
  aggregate_only: true  # Only share aggregated statistics
  allow_user_queries: true  # Allow querying other users
```

### Deployment Steps

1. **Clone and configure**:
   ```bash
   git clone https://github.com/mgifford/gh-summary.git
   cd gh-summary
   # Edit config.yml with your preferences
   ```

2. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: Deploy from a branch
   - Branch: `main` (or your default branch)
   - Folder: `/ (root)`

3. **Add GitHub Token (optional)**:
   - For private repository statistics, add `GITHUB_TOKEN` with repo access
   - Go to Settings → Secrets and variables → Actions
   - Add a new secret named `GITHUB_TOKEN` with your Personal Access Token

4. **Initial data generation**:
   ```bash
   export GITHUB_TOKEN=your_token_here  # optional
   node generate-data.mjs
   git add _data/
   git commit -m "Initial activity data"
   git push
   ```

5. **Access your site**:
   - Your GitHub Pages site will be available at:
   - `https://[username].github.io/gh-summary/`

### Automated Updates

The GitHub Actions workflow automatically runs on:
- The 15th of each month at 00:00 UTC
- The last day of each month at 00:00 UTC
- Manual trigger via GitHub Actions UI

The workflow generates fresh activity data and commits it to the `_data/` directory, which automatically updates your GitHub Pages site.

## CLI Usage

### User Activity Summary

```bash
node gh-summary.mjs --user <github-username> [options]
```

#### Options
- `--user <username>`: GitHub username (required)
- `--days <n>`: Number of days to look back (default: 31)
- `--timezone <tz>`: Timezone, e.g. Europe/Paris (default: system tz)
- `--include-private`: Include private events (requires `GITHUB_TOKEN`)
- `--detailed`: Show detailed listing of all events
- `--include <types>`: Comma-separated list of event types (e.g. `commit,issue,discussion`)
- `--help`: Show help screen

#### Examples

Summarize last 31 days of activity for `mgifford`:
```bash
node gh-summary.mjs --user mgifford --days 31
```

Show detailed events with commit messages and issue titles:
```bash
node gh-summary.mjs --user mgifford --detailed
```

Filter to only commits:
```bash
node gh-summary.mjs --user mgifford --include commit --detailed
```

Filter to only PRs and issues:
```bash
node gh-summary.mjs --user mgifford --include "pull request,issue"
```

Include private events (must authenticate as the same user):
```bash
export GITHUB_TOKEN=ghp_yourtokenhere
node gh-summary.mjs --user your-username --include-private
```

### Organization Activity Summary

```bash
node gh-org-summary.mjs --org <organization-name> [options]
```

#### Options
- `--org <orgname>`: GitHub organization (required)
- `--days <n>`: Number of days to look back (default: 31)
- `--timezone <tz>`: Timezone (default: system tz)
- `--include-private`: Include private events (requires `GITHUB_TOKEN`)
- `--detailed`: Show detailed listing of all events
- `--include <types>`: Comma-separated list of event types
- `--help`: Show help screen

#### Examples

Summarize organization activity:
```bash
node gh-org-summary.mjs --org civicactions --days 31
```

With detailed output:
```bash
node gh-org-summary.mjs --org civicactions --detailed
```

## Output Examples

**Summary mode (default):**
```
Wednesday 2025-08-13
  1 w3c/wcag2ict issue comment
  2 CivicActions/open-practice commit
  3 CivicActions/accessibility pull request
```

**Detailed mode (`--detailed`):**
```
Wednesday 2025-08-13
  CivicActions/open-practice commit: Fix typo in README
  CivicActions/open-practice commit: Add CONTRIBUTING guide
  w3c/wcag2ict issue: Clarify definition of accessible name
  w3c/wcag2ict issue comment: Added reference to WCAG 2.2
```

## Privacy and Security

- **Public data only**: When querying other users via the web interface, only public activity is displayed
- **Aggregated private stats**: For the default user, statistics about private repository contributions are included but no specific repository names or details are exposed
- **No data storage**: User queries via the web interface are not stored; data is fetched in real-time
- **Token security**: GitHub tokens are never exposed in the web interface and are only used server-side during data generation

## Requirements
- Node.js 18 or newer (for native `fetch`)
- Optional: a [GitHub Personal Access Token](https://github.com/settings/tokens) for private events

## Notes
- The GitHub Events API provides a rolling window of activity (usually a few hundred events per user)
- If you are very active, events older than that may not be available even within the chosen `--days` range
- Commit messages are truncated to the first line

## License
GPL3+
