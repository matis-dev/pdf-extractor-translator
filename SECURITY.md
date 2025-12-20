# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Security Model

### Privacy-First Architecture

PDF Content Extractor & Translator is designed with **data sovereignty** as a core principle:

```
┌─────────────────────────────────────────────────────────────┐
│                     YOUR MACHINE                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ PDF Files   │→ │ Application │→ │ Processed Output    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                          ↓                                  │
│                   ┌─────────────┐                          │
│                   │ Local AI    │                          │
│                   │ (Ollama)    │                          │
│                   └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                          ║
                          ╳ NO EXTERNAL CONNECTIONS
                          ║
┌─────────────────────────────────────────────────────────────┐
│                     INTERNET                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Cloud APIs  │  │ Analytics   │  │ Third-party Services│ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Key Guarantees:**
- ✅ All PDF processing happens locally
- ✅ No telemetry or analytics collection
- ✅ No data transmitted to external servers
- ✅ No API keys required for any feature
- ✅ Works completely offline after initial setup

---

## Reporting a Vulnerability

We take security seriously. If you discover a vulnerability, please follow responsible disclosure:

### 🔒 Private Disclosure (Preferred)

For sensitive security issues:

1. **Email:** security@[project-domain].com (or maintainer email)
2. **Subject:** `[SECURITY] Brief description`
3. **Include:**
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

**Response Timeline:**
- Acknowledgment: Within 48 hours
- Initial assessment: Within 7 days
- Resolution target: Within 30 days (severity-dependent)

### 🔓 Public Disclosure

For non-sensitive issues:

1. Open a [GitHub Issue](https://github.com/matis-dev/pdf-extractor-translator/issues/new)
2. Label it with `security`
3. Provide detailed reproduction steps

---

## Security Measures

### Input Validation

| Control                       | Implementation                   | Location          |
| ----------------------------- | -------------------------------- | ----------------- |
| **Filename Sanitization**     | `werkzeug.secure_filename()`     | `app.py`          |
| **File Type Validation**      | PDF magic bytes check            | `is_valid_file()` |
| **Path Traversal Prevention** | Allowed directory whitelist      | `mcp_server.py`   |
| **Size Limits**               | Configurable upload limits       | Flask config      |
| **Numeric Input Validation**  | Type casting with error handling | API endpoints     |

### File Handling

```python
# Example: Path validation
ALLOWED_DIRECTORIES = [
    Path.home() / "Documents",
    Path.home() / "Downloads",
    Path.home() / "Desktop",
    Path(__file__).parent.resolve()
]

def validate_path(file_path: str) -> bool:
    resolved = Path(file_path).resolve()
    return any(
        resolved.is_relative_to(allowed) 
        for allowed in ALLOWED_DIRECTORIES
    )
```

### Network Isolation

| Component | Binding           | External Access   |
| --------- | ----------------- | ----------------- |
| Flask App | `localhost:5000`  | ❌ None by default |
| Redis     | `localhost:6379`  | ❌ Local only      |
| Ollama    | `localhost:11434` | ❌ Local only      |
| ChromaDB  | Embedded          | ❌ No network      |

### Sensitive Data

| Data Type       | Storage      | Lifecycle    |
| --------------- | ------------ | ------------ |
| Uploaded PDFs   | `uploads/`   | User-managed |
| Processed files | `outputs/`   | User-managed |
| AI embeddings   | `chroma_db/` | Persistent   |
| Logs            | `logs/`      | Auto-rotated |

**Recommendation:** Implement regular cleanup:
```bash
# Clear files older than 7 days
find uploads/ outputs/ -type f -mtime +7 -delete
```

---

## Known Security Considerations

### Current Limitations

| Area                   | Status         | Notes                              |
| ---------------------- | -------------- | ---------------------------------- |
| **Authentication**     | ❌ None         | Designed for single-user local use |
| **Authorization**      | ❌ None         | All users have full access         |
| **Encryption at Rest** | ❌ None         | Files stored unencrypted           |
| **HTTPS**              | ❌ Not built-in | Use reverse proxy for production   |
| **Rate Limiting**      | ❌ None         | Add via reverse proxy              |

### Recommendations for Production Deployment

If exposing to a network:

1. **Use a Reverse Proxy:**
   ```nginx
   server {
       listen 443 ssl;
       server_name pdf.example.com;
       
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;
       
       location / {
           proxy_pass http://localhost:5000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

2. **Add Authentication:**
   - OAuth2 Proxy
   - HTTP Basic Auth
   - Flask-Login

3. **Enable Rate Limiting:**
   ```nginx
   limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
   
   location /api/ {
       limit_req zone=api burst=20;
       proxy_pass http://localhost:5000;
   }
   ```

4. **Restrict File Uploads:**
   ```python
   app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB
   ```

---

## Compliance

### Applicable Regulations

| Regulation | Applicability | Status                                        |
| ---------- | ------------- | --------------------------------------------- |
| **GDPR**   | EU users      | ✅ Compliant (no personal data leaves device)  |
| **HIPAA**  | Healthcare    | ✅ Suitable (self-hosted, no PHI transmission) |
| **CCPA**   | California    | ✅ Compliant (no data collection)              |
| **SOC 2**  | Enterprise    | ⚠️ N/A (not a cloud service)                   |

### Data Processing

- **Data Controller:** The user operating the application
- **Data Processor:** N/A (no third-party processing)
- **Data Retention:** User-controlled (no automatic deletion)
- **Data Export:** All files accessible in filesystem

---

## Dependency Security

### Monitoring

We use the following tools to monitor dependencies:

- **Dependabot:** Automated vulnerability alerts
- **pip-audit:** Python package vulnerability scanning
- **npm audit:** JavaScript dependency scanning

### Update Policy

| Severity | Response Time      |
| -------- | ------------------ |
| Critical | Within 24 hours    |
| High     | Within 7 days      |
| Medium   | Next release cycle |
| Low      | Best effort        |

### Running Security Scans

```bash
# Python dependencies
pip install pip-audit
pip-audit

# Check for known vulnerabilities
safety check -r requirements.txt
```

---

## Security Checklist for Contributors

Before submitting a PR, ensure:

- [ ] No hardcoded secrets or credentials
- [ ] All user input is validated
- [ ] File paths use `secure_filename()`
- [ ] No new external network calls introduced
- [ ] Error messages don't leak sensitive information
- [ ] Logging doesn't include sensitive data
- [ ] New dependencies are reviewed for vulnerabilities

---

## Bug Bounty

We currently do not have a formal bug bounty program. However, we deeply appreciate security researchers who help improve our security posture. Responsible disclosure will be acknowledged in our release notes and contributors list.

---

## Contact

- **Security Issues:** [Create private advisory](https://github.com/matis-dev/pdf-extractor-translator/security/advisories/new)
- **General Issues:** [GitHub Issues](https://github.com/matis-dev/pdf-extractor-translator/issues)

---

*Last updated: 2025-12-20*
