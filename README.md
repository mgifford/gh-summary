# GitHub Activity Summarizer

A Node.js CLI tool to fetch and summarize your (or any user’s) GitHub activity over the last N days. Output is grouped by day and repository, with options for high‑level counts or detailed event listings.

## Features
- Summarize GitHub activity by day.
- Group by repository and event type.
- Show either **counts** or **detailed event lists**.
- Supports commits, issues, pull requests, reviews, discussions, wiki edits, releases, and more.
- Filter output to only certain event types (`--include`).
- Works with public activity out‑of‑the‑box; add a GitHub token to include private events.

## Requirements
- Node.js 18 or newer (for native `fetch`).
- Optional: a [GitHub Personal Access Token](https://github.com/settings/tokens) if you want to include private events.

## Installation
Clone this repository and install dependencies (none are required beyond Node 18):

```bash
git clone https://github.com/yourname/github-activity-summary.git
cd github-activity-summary
chmod +x gh-31day-summary.mjs
```

## Usage

```bash
node gh-31day-summary.mjs --user <github-username> [options]
```

### Options
- `--user <username>`: GitHub username to fetch (required).
- `--days <n>`: Number of days to look back (default: 31).
- `--timezone <tz>`: Timezone string (default: system timezone).
- `--include-private`: Include private events (requires `GITHUB_TOKEN`).
- `--detailed`: Show detailed listing of all events (with commit messages, issue/PR titles, etc.).
- `--include <types>`: Comma‑separated list of event types to include (e.g. `commit,issue,discussion`).
- `--help`: Show usage help.

### Examples

Summarize last 31 days of activity for `mgifford`:
```bash
node gh-31day-summary.mjs --user mgifford --days 31
```

Show detailed events with commit messages and issue titles:
```bash
node gh-31day-summary.mjs --user mgifford --detailed
```

Filter to only commits:
```bash
node gh-31day-summary.mjs --user mgifford --include commit --detailed
```

Filter to only PRs and issues:
```bash
node gh-31day-summary.mjs --user mgifford --include "pull request,issue"
```

Filter to only discussions:
```bash
node gh-31day-summary.mjs --user mgifford --include discussion,discussion comment --detailed
```

Include private events (must authenticate as the same user):
```bash
export GITHUB_TOKEN=ghp_yourtokenhere
node gh-31day-summary.mjs --user your-username --include-private
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

## Notes
- The GitHub Events API provides a rolling window of activity (usually a few hundred events per user). If you are very active, events older than that may not be available even within the chosen `--days` range.
- Commit messages are truncated to the first line.

## License
MIT
