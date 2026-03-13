# GitHub API Limitations for Usage & AI Data

This document explains what data is and is not available from the GitHub API for the
**Usage & AI** page (`usage.html`), and what token scopes are required to enable each section.

## What Is Available

| Section | Data | Required Scope | Notes |
|---------|------|---------------|-------|
| GitHub Actions | Run counts, durations, success rates | `repo` (read) via default `GITHUB_TOKEN` | Fetches from public repos; private repos need `repo` scope |
| Copilot Subscription | Plan type, last activity | `read:user` (PAT only) | Default `GITHUB_TOKEN` does **not** grant access to Copilot subscription status |
| Copilot Org Metrics | Active/engaged users per org | `manage_billing:copilot` (org admin only) | Requires org admin role; not available for personal accounts or non-admin members |
| Codespaces | List of codespaces and their state | `codespace` (PAT only) | Default `GITHUB_TOKEN` does **not** include Codespaces access |
| Projects | Classic project boards | `read:project` (PAT only) | Default `GITHUB_TOKEN` does **not** include project read access |

## Why Data May Show as Unavailable

The scheduled GitHub Actions workflow that generates `_data/usage.json` uses the default
`secrets.GITHUB_TOKEN`, which is scoped to the repository and does **not** include the
additional OAuth scopes required to read Copilot subscription status, Codespaces, or Projects.

To enable these sections, **create a Personal Access Token (PAT)** with the following scopes
and add it as a repository secret named `GH_PAT`:

- `read:user` — to read Copilot subscription status
- `codespace` — to list Codespaces
- `read:project` — to list classic Projects
- `manage_billing:copilot` — to read org-level Copilot metrics (org admins only)

Then update the workflow step in `.github/workflows/generate-data.yml` to use
`${{ secrets.GH_PAT }}` instead of `${{ secrets.GITHUB_TOKEN }}` for the
**Generate usage data** step.

## What Is Not Available from the GitHub API

The following information is **not exposed** via the GitHub API at all:

- **Per-request AI energy usage**: GitHub does not provide per-request energy or carbon
  data for Copilot completions, chat turns, or agent tasks.
- **Detailed Copilot completion metrics for individuals**: Suggestion acceptance rates,
  number of completions shown, lines of code accepted, etc. are only available at the
  **organisation level** via `GET /orgs/{org}/copilot/metrics` (requires
  `manage_billing:copilot` scope and org admin access).
- **Copilot usage for arbitrary users**: There is no public API endpoint to query another
  user's Copilot usage. Only the authenticated user's own subscription status is accessible.

GitHub publishes sustainability information in its annual
[Sustainability Reports](https://github.blog/tag/sustainability/) and operates the
[Copilot Trust Center](https://resources.github.com/copilot-trust-center/) for transparency
on AI-related data.

## Console Errors from Browser Extensions

If you see console errors like:

```
background-redux-new.js:1 Uncaught (in promise) Error: No tab with id: 987659447.
Unchecked runtime.lastError: Cannot create item with duplicate id LastPass
```

these originate from a **browser extension** (such as LastPass or a similar password
manager) and are **not caused by this application**. They cannot be suppressed by the
gh-summary code. To eliminate these errors, disable or update the browser extension
that is producing them.

## Debugging

When you open the browser console on `usage.html`, this application logs diagnostic
messages prefixed with `[gh-summary/usage]` to help you understand what data was loaded
and why certain sections may be unavailable. Look for lines such as:

```
[gh-summary/usage] Loaded usage.json: user=mgifford generated=2026-03-12T00:00:00.000Z
[gh-summary/usage] copilot.subscription unavailable: Requires a Personal Access Token (PAT) with read:user scope — default GITHUB_TOKEN does not include this scope. See API-LIMITATIONS.md.
[gh-summary/usage] Tip: set GH_PAT secret with read:user, codespace, read:project scopes
```
