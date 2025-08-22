# GitHub Organization Activity Summarizer (`gh-org-summary.mjs`)

This script summarizes activity across all members of a GitHub organization. It fetches recent events, groups them by date, repository, and type, and provides both summary and detailed views. It can be run against public or private orgs (with an appropriate token).

## Features

- Fetches all members of an organization (via API or public org pages as fallback).
- Summarizes activity per repository and per user over a configurable time window.
- Groups by day, repository, and event type (commits, issues, PRs, discussions, etc).
- Optionally shows **detailed** lists of events, including commit messages and issue/PR/discussion titles.
- Supports filtering by event types (commits, issues, discussions, etc).
- Provides summary statistics:
  - Total events
  - Average events per day
  - Top contributors
  - Most active repositories

## Requirements

- Node.js 18+ (uses `fetch`).
- (Optional) GitHub Personal Access Token  
  Store in `GITHUB_TOKEN` to access private events and avoid rate limiting.

```bash
export GITHUB_TOKEN=ghp_yourtokenhere
```

## Installation

Clone the repo:

```bash
git clone https://github.com/mgifford/gh-summary.git
cd gh-summary
```

Make the script executable:

```bash
chmod +x gh-org-summary.mjs
```

Or run with `node`:

```bash
node gh-org-summary.mjs --help
```

## Usage

Basic example (last 31 days):

```bash
node gh-org-summary.mjs --org civicactions
```

Detailed activity with event listings:

```bash
node gh-org-summary.mjs --org civicactions --days 7 --detailed
```

Filter by event type (commits, issues, discussions):

```bash
node gh-org-summary.mjs --org civicactions --include commit,issue,discussion
```

Include private events (requires token):

```bash
node gh-org-summary.mjs --org civicactions --include-private
```

Specify timezone:

```bash
node gh-org-summary.mjs --org civicactions --timezone "Europe/Paris"
```

## Options

```
--org <orgname>         GitHub organization (required)
--days <n>              Number of days to look back (default: 31)
--timezone <tz>         Timezone (default: system tz)
--include-private       Include private events (requires GITHUB_TOKEN)
--detailed              Show detailed listing of all events
--include <types>       Comma-separated event types (commit,issue,discussion,…)
--help                  Show help screen
```

## Output

- **Summary mode** shows counts of activity by day, repo, and type.
- **Detailed mode** lists individual events with commit messages, issue/PR/discussion titles, and links.
- Final section includes:
  - Total events in range
  - Average events per day
  - Top 10 contributors
  - Top 10 repositories
