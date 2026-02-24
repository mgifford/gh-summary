# Quick Start Guide

Get your GitHub Activity Summarizer running on GitHub Pages in 5 minutes!

## Prerequisites
- A GitHub account
- A repository (this one or a fork)
- 5 minutes ⏰

## Step 1: Enable GitHub Pages (1 minute)

1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Under **Source**, select:
   - Branch: `main`
   - Folder: `/ (root)`
4. Click **Save**

Your site will be at: `https://[your-username].github.io/gh-summary/`

## Step 2: Configure Your Username (1 minute)

Edit `config.yml`:
```yaml
default_user: your-github-username  # Change this!
```

Commit and push:
```bash
git add config.yml
git commit -m "Update username"
git push
```

## Step 3: Generate Initial Data (2 minutes)

**Option A: Wait for automatic generation** (no work required)
- Workflow runs on 15th and last day of each month
- First data will appear on next scheduled run

**Option B: Generate now** (requires Node.js 18+)
```bash
node generate-data.mjs
git add _data/
git commit -m "Initial data"
git push
```

**Option C: Use GitHub Actions manually**
1. Go to **Actions** tab
2. Click "Generate Activity Data"
3. Click "Run workflow"
4. Wait 1 minute

## Step 4: Visit Your Site! (1 minute)

Open: `https://[your-username].github.io/gh-summary/`

You should see:
- ✅ Your activity statistics
- ✅ Charts showing activity by type
- ✅ Top repositories
- ✅ Daily timeline
- ✅ Query form for other users

## Optional: Add Private Stats

To include aggregated stats from private repos:

1. Create a [Personal Access Token](https://github.com/settings/tokens) with `repo` scope
2. Go to repository **Settings** → **Secrets and variables** → **Actions**
3. Add secret: `GITHUB_TOKEN` = your token
4. Manually trigger workflow or wait for next scheduled run

## That's It! 🎉

Your GitHub Pages site is now live and will automatically update twice per month.

## What's Next?

- **Customize appearance**: Edit `styles.css`
- **Adjust schedule**: Edit `.github/workflows/generate-data.yml`
- **Change settings**: Edit `config.yml`
- **Read full docs**: See [README.md](README.md) and [SETUP.md](SETUP.md)

## Troubleshooting

### Site shows 404
- Wait 5-10 minutes after enabling Pages
- Check Settings → Pages for deployment status
- Ensure branch is `main` and folder is `/ (root)`

### No data showing
- Check if `_data/activity.json` exists in repository
- Run Step 3 to generate initial data
- Check Actions tab for workflow runs

### "User not found" error
- Verify username in `config.yml`
- Ensure username is spelled correctly
- Check if user profile is public

## Need Help?

- 📖 [Full Setup Guide](SETUP.md)
- 📖 [README](README.md)
- 🐛 [Report Issues](https://github.com/mgifford/gh-summary/issues)
- 💬 [Discussions](https://github.com/mgifford/gh-summary/discussions)

## Privacy Note

- ✅ Only public data for queried users
- ✅ Aggregated stats only for private repos
- ✅ No sensitive data exposed
- ✅ No tracking or analytics

Enjoy your GitHub Activity Summarizer! 🚀
