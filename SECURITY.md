# Security Policy

## Supported Versions

We release security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | :white_check_mark: |
| < 0.3   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow these steps:

### DO NOT open a public issue!

Instead, please report security vulnerabilities by:

1. **Email**: Send details to the project maintainer
   - Include a description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

2. **What to expect**:
   - Acknowledgment within 48 hours
   - Status update within 7 days
   - Coordinated disclosure timeline

### Security Best Practices for Deployments

When deploying 智办AI in production:

1. **Environment Variables**
   - Never commit `.env` files
   - Use strong, unique `SECRET_KEY` and `JWT_SECRET`
   - Rotate credentials regularly

2. **Network Security**
   - Use HTTPS in production
   - Configure proper CORS origins (don't use `*`)
   - Limit API rate limiting appropriately

3. **Model & Data**
   - Keep model weights secure (not in public repos)
   - Sanitize user inputs before processing
   - Implement proper access controls

4. **Dependencies**
   - Regularly update dependencies: `npm audit` / `pip audit`
   - Monitor security advisories for used packages

## Known Security Considerations

| Area | Status | Notes |
|------|--------|-------|
| API Authentication | ⚠️ Basic | JWT implemented, enhance for production |
| Input Validation | ✅ Done | Pydantic models + type checking |
| SQL Injection | ✅ Safe | Uses parameterized queries |
| XSS Prevention | ✅ Safe | React's built-in escaping |
| CORS Configuration | ⚠️ Configurable | Default is permissive, tighten in production |
| Secret Management | ⚠️ User Config | `.env.example` provided |
| Dependency Scanning | 🔲 TODO | Add CI/CD automated scanning |

## Security Updates

Security updates will be announced in:
- GitHub Security Advisories
- Release notes
- CHANGELOG.md entries marked with `[security]`

---

Thank you for helping keep 智办AI and its users safe!
