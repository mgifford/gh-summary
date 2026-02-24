# Contributing to GitHub Activity Summarizer

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites
- Node.js 18 or newer
- Git
- A GitHub account
- Optional: A text editor with JavaScript/HTML/CSS support

### Local Development

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/your-username/gh-summary.git
   cd gh-summary
   ```

2. **Test the CLI tools**:
   ```bash
   # Test user summary
   node gh-summary.mjs --user mgifford --days 7
   
   # Test organization summary
   node gh-org-summary.mjs --org civicactions --days 7
   ```

3. **Test the data generator**:
   ```bash
   node generate-data.mjs
   # Check the generated files in _data/
   ```

4. **Test the web interface**:
   ```bash
   # Serve the files locally (using any static server)
   python3 -m http.server 8000
   # Or use Node's http-server:
   # npx http-server -p 8000
   
   # Open http://localhost:8000 in your browser
   ```

## Making Changes

### Code Structure

```
gh-summary/
├── gh-summary.mjs           # CLI tool for user activity
├── gh-org-summary.mjs       # CLI tool for organization activity
├── generate-data.mjs        # Data generator for GitHub Pages
├── config.yml               # Configuration file
├── index.html               # Web interface HTML
├── app.js                   # Web interface JavaScript
├── styles.css               # Web interface styles
├── _data/                   # Cached activity data
│   ├── activity.json
│   └── metadata.json
└── .github/
    └── workflows/
        ├── generate-data.yml # Scheduled data generation
        └── pages.yml         # GitHub Pages deployment
```

### Code Style

- Use 2 spaces for indentation (JavaScript, HTML, CSS)
- Use meaningful variable names
- Add comments for complex logic
- Follow existing code patterns

### Testing Your Changes

1. **CLI tools**: Run with various options to ensure they work
2. **Data generator**: Verify JSON output is valid
3. **Web interface**: Test in multiple browsers (Chrome, Firefox, Safari)
4. **Mobile responsive**: Test on mobile viewport sizes
5. **Accessibility**: Ensure keyboard navigation works

## Types of Contributions

### Bug Fixes
- Check existing issues for known bugs
- Create a new issue if not already reported
- Submit a PR with the fix

### New Features
- Discuss in an issue first
- Ensure it aligns with the project's privacy-first philosophy
- Update documentation

### Documentation
- Fix typos or unclear explanations
- Add examples
- Improve setup instructions

### Design Improvements
- Enhance visual design
- Improve accessibility
- Optimize performance

## Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Write clean, well-commented code
   - Test thoroughly
   - Update documentation if needed

3. **Commit with clear messages**:
   ```bash
   git add .
   git commit -m "Add feature: brief description"
   ```

4. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open a Pull Request**:
   - Go to the original repository on GitHub
   - Click "New Pull Request"
   - Select your branch
   - Describe your changes clearly
   - Reference any related issues

6. **Respond to feedback**:
   - Address reviewer comments
   - Make requested changes
   - Push updates to the same branch

## Privacy and Security Guidelines

**IMPORTANT**: This project is privacy-focused. Always ensure:

1. **No Sensitive Data Exposure**:
   - Never log or display private repository names (unless aggregate_only is false)
   - Never expose commit messages from private repos
   - Never expose issue/PR titles from private repos
   - Never expose user tokens or credentials

2. **Aggregated Statistics Only**:
   - For private repos, only show counts (e.g., "5 commits in private repositories")
   - Never link private repo names with specific users or content

3. **User Query Privacy**:
   - Only fetch public data for user queries
   - Don't store or cache queried user data
   - Respect API rate limits

4. **Token Security**:
   - Never commit tokens to the repository
   - Use environment variables for tokens
   - Document token requirements clearly

## Reporting Security Issues

If you discover a security vulnerability:
1. **DO NOT** open a public issue
2. Email the maintainer directly (check GitHub profile)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Help others learn

## Questions?

- Open an issue for general questions
- Check existing issues and PRs
- Review the README and SETUP documentation

## License

By contributing, you agree that your contributions will be licensed under the GPL3+ license.

Thank you for contributing to GitHub Activity Summarizer! 🎉
