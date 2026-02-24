# Data Format Documentation

This document describes the JSON data formats used by the GitHub Activity Summarizer.

## activity.json

The main data file that contains all activity information.

### Structure

```json
{
  "user": "string",
  "generated": "ISO 8601 datetime",
  "period": {
    "days": "number",
    "start": "YYYY-MM-DD",
    "end": "YYYY-MM-DD"
  },
  "summary": {
    "totalEvents": "number",
    "totalDaysWithActivity": "number",
    "averagePerDay": "string (number with 1 decimal)",
    "topRepositories": [
      {
        "repo": "string (owner/repo or 'private-repos')",
        "count": "number"
      }
    ],
    "activityByType": [
      {
        "type": "string",
        "count": "number"
      }
    ]
  },
  "dailyActivity": [
    {
      "date": "Weekday YYYY-MM-DD",
      "total": "number",
      "byType": {
        "commit": "number",
        "issue": "number",
        ...
      },
      "byRepo": {
        "owner/repo": "number",
        ...
      },
      "events": [
        {
          "type": "string",
          "repo": "string",
          "timestamp": "ISO 8601 datetime",
          "title": "string (optional)",
          "number": "number (optional)",
          "url": "string (optional)",
          "commits": [
            {
              "message": "string",
              "sha": "string (7 chars)"
            }
          ]
        }
      ]
    }
  ]
}
```

### Example

```json
{
  "user": "mgifford",
  "generated": "2024-02-24T22:00:00.000Z",
  "period": {
    "days": 31,
    "start": "2024-01-24",
    "end": "2024-02-24"
  },
  "summary": {
    "totalEvents": 127,
    "totalDaysWithActivity": 18,
    "averagePerDay": "4.1",
    "topRepositories": [
      {
        "repo": "mgifford/gh-summary",
        "count": 45
      },
      {
        "repo": "w3c/wcag2ict",
        "count": 32
      },
      {
        "repo": "private-repos",
        "count": 50
      }
    ],
    "activityByType": [
      {
        "type": "commit",
        "count": 67
      },
      {
        "type": "pull request",
        "count": 28
      },
      {
        "type": "issue comment",
        "count": 32
      }
    ]
  },
  "dailyActivity": [
    {
      "date": "Monday 2024-02-19",
      "total": 12,
      "byType": {
        "commit": 8,
        "pull request": 2,
        "issue comment": 2
      },
      "byRepo": {
        "mgifford/gh-summary": 10,
        "private-repos": 2
      },
      "events": [
        {
          "type": "commit",
          "repo": "mgifford/gh-summary",
          "timestamp": "2024-02-19T15:30:00Z",
          "commits": [
            {
              "message": "Add GitHub Pages support",
              "sha": "a1b2c3d"
            }
          ]
        },
        {
          "type": "pull request",
          "repo": "mgifford/gh-summary",
          "timestamp": "2024-02-19T16:00:00Z",
          "title": "Implement web interface",
          "number": 42,
          "url": "https://github.com/mgifford/gh-summary/pull/42"
        }
      ]
    }
  ]
}
```

## metadata.json

Tracks when data was last generated and when the next update is scheduled.

### Structure

```json
{
  "lastUpdate": "ISO 8601 datetime",
  "user": "string",
  "nextScheduled": "YYYY-MM-DD"
}
```

### Example

```json
{
  "lastUpdate": "2024-02-15T00:05:23.456Z",
  "user": "mgifford",
  "nextScheduled": "2024-02-29"
}
```

## Event Types

The following event types are tracked:

| Type | GitHub Event | Description |
|------|--------------|-------------|
| `commit` | PushEvent | Code commits |
| `issue` | IssuesEvent | Issue opened/closed |
| `issue comment` | IssueCommentEvent | Comment on issue |
| `pull request` | PullRequestEvent | PR opened/closed/merged |
| `pr review` | PullRequestReviewEvent | PR review submitted |
| `pr review comment` | PullRequestReviewCommentEvent | Comment on PR review |
| `commit comment` | CommitCommentEvent | Comment on commit |
| `discussion` | DiscussionEvent | Discussion created |
| `discussion comment` | DiscussionCommentEvent | Comment on discussion |
| `wiki` | GollumEvent | Wiki page edited |
| `create` | CreateEvent | Branch/tag created |
| `delete` | DeleteEvent | Branch/tag deleted |
| `release` | ReleaseEvent | Release published |

## Privacy Considerations

### Private Repository Data

When `config.yml` has `privacy.aggregate_only: true`:

1. **Repository names**: Private repos are grouped as `"private-repos"`
2. **Event details**: Only counts are stored, no titles or messages
3. **Events array**: Empty for private repo activities

Example with private repos (aggregate_only: true):
```json
{
  "byRepo": {
    "public-org/public-repo": 10,
    "private-repos": 5  // Aggregated count
  }
}
```

### Public User Queries

When querying other users via the web interface:
- Only public events are fetched
- Data is processed client-side
- No data is stored or cached
- Respects GitHub API rate limits

## Field Details

### Date Formats

- `generated`, `lastUpdate`, `timestamp`: ISO 8601 format with timezone
- `start`, `end`, `nextScheduled`: YYYY-MM-DD format
- `date` in dailyActivity: "Weekday YYYY-MM-DD" (e.g., "Monday 2024-02-19")

### Counts

- `totalEvents`: Total number of GitHub events in the period
- `totalDaysWithActivity`: Number of days with at least one event
- `averagePerDay`: Total events divided by period days, formatted as string with 1 decimal

### Repository Names

- Format: `owner/repository` for regular repos
- Special value: `private-repos` for aggregated private repository stats
- May be `unknown` if repository information is unavailable

## Regenerating Data

To regenerate the data files:

```bash
# Set token if including private stats
export GITHUB_TOKEN=your_token_here

# Run generator
node generate-data.mjs

# Files are written to:
# - _data/activity.json
# - _data/metadata.json
```

## Consuming the Data

### JavaScript (Client-side)

```javascript
// Fetch and parse activity data
const response = await fetch('_data/activity.json');
const data = await response.json();

console.log(`Total events: ${data.summary.totalEvents}`);
console.log(`Active days: ${data.summary.totalDaysWithActivity}`);

// Iterate through daily activity
data.dailyActivity.forEach(day => {
  console.log(`${day.date}: ${day.total} events`);
});
```

### Other Languages

The JSON files follow standard JSON format and can be parsed by any JSON library.

## Validation

To validate the JSON structure:

```bash
# Check activity.json
node -e "console.log('Valid:', !!require('./_data/activity.json').user)"

# Check metadata.json
node -e "console.log('Valid:', !!require('./_data/metadata.json').lastUpdate)"
```
