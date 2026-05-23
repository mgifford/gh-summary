# AGENTS.md

This repository is privacy-first and should be reviewed for security on a regular basis.

## Security Review Requirements

Security must be considered for every meaningful change, especially changes touching API access, token handling, data display, workflows, and generated artifacts.

### Required checks for every PR

- Confirm no secrets, tokens, or credentials are committed.
- Confirm private repository names, titles, and messages are never exposed in output when aggregation is required.
- Confirm all GitHub API requests include a `User-Agent` header.
- Confirm no new dependency or tool introduces unnecessary risk.
- Confirm workflow changes use pinned major versions intentionally and least-privilege permissions.

### Recurring review cadence

- Review these security checks during every PR review.
- Perform a broader security review at least monthly or before a release.
- Re-check `SBOM.md` whenever runtimes, workflows, or dependencies change.

## References

- `CONTRIBUTING.md` (Privacy and Security Guidelines)
- `API-LIMITATIONS.md`
- `SBOM.md`
