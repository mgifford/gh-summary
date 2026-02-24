# GitHub Pages Setup Guide

This guide will walk you through setting up the GitHub Activity Summarizer as a GitHub Pages site.

## Quick Start

### 1. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (top right)
3. Scroll down to **Pages** (in the left sidebar)
4. Under **Source**, select:
   - **Source**: Deploy from a branch
   - **Branch**: `main` (or your default branch name)
   - **Folder**: `/ (root)`
5. Click **Save**

GitHub will automatically build and deploy your site. The URL will be displayed at the top of the Pages settings page (usually `https://[username].github.io/gh-summary/`).

### 2. Configure Your Settings

Edit `config.yml` to customize:

```yaml
# Change this to your GitHub username
default_user: your-github-username

# Adjust schedule if needed
schedule:
  frequency: bimonthly  # or 'monthly'
  timezone: America/Toronto  # Your timezone

# Adjust activity settings
activity:
  days: 31
  include_private_stats: true  # Only aggregated stats
```

Commit and push your changes:
```bash
git add config.yml
git commit -m "Update configuration"
git push
```

### 3. Generate Initial Data

To populate your site with data immediately (optional):

```bash
# Optional: Set GITHUB_TOKEN for private repo stats
export GITHUB_TOKEN=your_personal_access_token

# Generate data
node generate-data.mjs

# Commit and push
git add _data/
git commit -m "Initial activity data"
git push
```

**Note**: If you don't generate initial data, the site will show placeholder data until the first scheduled run.

### 4. Add GitHub Token (Optional)

To include aggregated statistics from private repositories:

1. Create a [Personal Access Token](https://github.com/settings/tokens) with `repo` scope
2. Go to your repository **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `GITHUB_TOKEN`
5. Value: Your personal access token
6. Click **Add secret**

The automated workflow will use this token to generate statistics that include private repository contributions (aggregated only, no details exposed).

## Schedule Configuration

The default schedule runs on:
- The 15th of each month at 00:00 UTC
- The last day of each month at 00:00 UTC

### Customizing the Schedule

Edit `.github/workflows/generate-data.yml` to change the schedule:

```yaml
on:
  schedule:
    # Examples:
    # - cron: '0 0 1 * *'    # First day of month
    # - cron: '0 0 * * 0'    # Every Sunday
    # - cron: '0 0 * * 1'    # Every Monday
```

For more cron syntax help, see [Crontab Guru](https://crontab.guru/).

## Privacy Settings

The tool is designed to be privacy-respecting:

### For Your Default User
- **With `aggregate_only: true`**: Only shows aggregated statistics (e.g., "X events in private repositories")
- **With `aggregate_only: false`**: Shows repository names but still no sensitive content
- **Private repo names are never shown** when `aggregate_only` is enabled
- **No commit messages, PR titles, or issue content** from private repos are ever displayed

### For Queried Users
- **Only public data** is fetched and displayed
- **No data is stored** - queries are real-time only
- **Rate limited** by GitHub API

## Troubleshooting

### Site Not Loading

1. **Check GitHub Pages is enabled**: Settings → Pages
2. **Check deployment status**: Actions tab → Pages build and deployment workflow
3. **Wait a few minutes**: Initial deployment can take 5-10 minutes

### No Data Showing

1. **Check if data files exist**: Look for `_data/activity.json` in your repository
2. **Run data generation manually**:
   ```bash
   node generate-data.mjs
   git add _data/
   git commit -m "Add activity data"
   git push
   ```
3. **Check workflow runs**: Actions tab → Generate Activity Data workflow

### API Rate Limiting

If you query too many users too quickly, you may hit GitHub's API rate limit:
- **Unauthenticated**: 60 requests/hour
- **Authenticated**: 5,000 requests/hour

Add a Personal Access Token to increase your rate limit.

### Workflow Not Running

1. **Check workflow file**: Ensure `.github/workflows/generate-data.yml` exists
2. **Check Actions permissions**: Settings → Actions → General → Workflow permissions
   - Select "Read and write permissions"
3. **Check the date**: The workflow only runs on the 15th and last day of month
4. **Manual trigger**: Go to Actions → Generate Activity Data → Run workflow

## Updating

To get the latest version:

```bash
git pull
# Review changes
git push
```

Your custom `config.yml` settings will be preserved.

## Advanced Configuration

### Custom Styling

Edit `styles.css` to customize the appearance:
- Colors in `:root` section
- Fonts in `body` section
- Layout in grid sections

### Custom Event Types

To track only specific types of events, edit `config.yml`:

```yaml
activity:
  include_types:
    - commit
    - pull request
    - issue
```

Leave empty `[]` to track all event types.

### Timezone Considerations

The `schedule.timezone` in `config.yml` affects:
- How dates are displayed in the activity timeline
- When "today" starts and ends

The GitHub Actions schedule runs in UTC regardless of this setting.

## Support

For issues or questions:
1. Check the [README](README.md) for general documentation
2. Review the [GitHub Issues](https://github.com/mgifford/gh-summary/issues)
3. Open a new issue if needed

## Privacy Policy

- Public data only for queried users
- Aggregated statistics only for private repos (when configured)
- No tracking or analytics
- No data collection beyond GitHub API
- Client-side processing for user queries
