# Contributing to GRC Security Suite

First off, thank you for considering contributing to GRC Security Suite! It's people like you that make this project such a great tool for the security community.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
- [Style Guidelines](#style-guidelines)
- [Commit Messages](#commit-messages)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/grc-security-suite.git
   cd grc-security-suite
   ```
3. **Set up the development environment**:
   ```bash
   # Install dependencies for each module
   cd autoaudit && npm install
   cd ../grc-pulse && npm install
   cd ../pentest-pulse && npm install
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## How Can I Contribute?

### 🐛 Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- **Clear title** describing the issue
- **Steps to reproduce** the behavior
- **Expected behavior** vs actual behavior
- **Screenshots** if applicable
- **Environment details** (browser, OS, etc.)

### 💡 Suggesting Features

Feature suggestions are welcome! Please include:

- **Clear description** of the feature
- **Use case** - why is this needed?
- **Possible implementation** approach
- **Mockups or examples** if applicable

### 🔧 Pull Requests

1. **Update documentation** for any changed functionality
2. **Add tests** if applicable
3. **Follow the coding style** of the project
4. **Write clear commit messages**
5. **Reference any related issues**

## Style Guidelines

### JavaScript/TypeScript

- Use ES6+ features
- Use meaningful variable and function names
- Add comments for complex logic
- Follow existing code patterns

### React Components

- Use functional components with hooks
- Keep components focused and small
- Use TypeScript for new components in GRC Pulse and Pentest Pulse

### CSS

- Use TailwindCSS utility classes
- Maintain consistent spacing
- Support dark mode where applicable

## Commit Messages

Use clear, descriptive commit messages:

```
feat: Add NIST CSF framework support to GRC Pulse
fix: Resolve evidence upload issue in AutoAudit
docs: Update README with deployment instructions
style: Format code according to style guide
refactor: Simplify risk calculation logic
test: Add unit tests for CVSS scoring
```

### Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

---

Thank you for contributing! 🙏
