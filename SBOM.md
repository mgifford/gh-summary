# SBOM

Software Bill of Materials for `gh-summary`.

## Project Metadata

- Project: `gh-summary`
- Version: `1.0.0` (from `package.json`)
- Project license: `GPL-3.0-or-later` (README states GPL3+)
- Package manager dependencies: none (no `dependencies` or `devDependencies` in `package.json`)

## Runtime Components

| Component | Version / Constraint | Purpose | License |
|---|---|---|---|
| Node.js | `>=18` | Runs CLI tools and data generators | MIT |
| Python (optional) | `3.x` | Optional local static file serving (`python3 -m http.server`) | PSF-2.0 |

## GitHub Actions Components

| Component | Version | Workflow(s) | License |
|---|---|---|---|
| `actions/checkout` | `v4` | `generate-data.yml`, `pages.yml` | MIT |
| `actions/setup-node` | `v4` | `generate-data.yml` | MIT |
| `actions/configure-pages` | `v4` | `pages.yml` | MIT |
| `actions/upload-pages-artifact` | `v3` | `pages.yml` | MIT |
| `actions/deploy-pages` | `v4` | `pages.yml` | MIT |

## Maintenance

Update this file whenever any of the following changes:

- runtime requirements (for example Node.js version constraints),
- GitHub Action versions,
- direct dependencies or tooling,
- project licensing.
