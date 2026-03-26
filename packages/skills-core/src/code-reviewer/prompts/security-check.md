Perform a security audit of `{{targetPath}}` in a **{{context}}** context.

## Steps

1. **Read the target code**
   Use `file:read` to load `{{targetPath}}`. If it's a directory, enumerate files and prioritize:
   - Route handlers / API endpoints
   - Authentication / authorization logic
   - Database queries and ORM usage
   - File system operations
   - External service integrations
   - Configuration and secret management

2. **Run security-focused lint rules**
   Use `lint:run` with security-specific rules if available (e.g. `eslint-plugin-security`, `bandit`, `gosec`).

3. **AST-based pattern detection**
   Use `ast:query` to find:
   - `calls:eval` / `calls:exec` / `calls:Function` — code injection vectors
   - `calls:innerHTML` / `calls:dangerouslySetInnerHTML` — XSS sinks
   - `calls:query` / `calls:execute` — SQL injection points
   - `pattern:hardcoded secrets` — strings matching API key / token patterns

4. **Manual analysis by category**

{{#if context === 'web-api'}}
   **Injection (OWASP A03)**
   - SQL injection: parameterized queries vs string concatenation
   - Command injection: shell exec with user input
   - NoSQL injection: unvalidated query objects
   - XSS: output encoding, CSP headers, sanitization

   **Broken Authentication (OWASP A07)**
   - Password hashing (bcrypt/argon2 vs MD5/SHA1)
   - Session management (secure cookies, token rotation)
   - Rate limiting on auth endpoints
   - MFA implementation

   **Broken Access Control (OWASP A01)**
   - Authorization checks on every protected route
   - IDOR (Insecure Direct Object Reference) via predictable IDs
   - Missing ownership validation
   - Privilege escalation paths

   **Security Misconfiguration (OWASP A05)**
   - CORS policy (wildcard origins, credentials)
   - Security headers (HSTS, X-Frame-Options, CSP)
   - Verbose error messages exposing internals
   - Debug mode / dev tools in production paths

   **Cryptographic Failures (OWASP A02)**
   - Hardcoded secrets, API keys, connection strings
   - Weak algorithms (MD5, SHA1 for passwords)
   - Missing TLS enforcement
   - Insufficient entropy in tokens/nonces
{{/if}}

{{#if context === 'cli'}}
   **Input Validation**
   - Command-line argument injection
   - Path traversal in file arguments
   - Symlink following attacks

   **Privilege & Permissions**
   - Unnecessary elevated permissions
   - Insecure temp file creation
   - World-readable sensitive files

   **Supply Chain**
   - Dependency vulnerabilities
   - Post-install script risks
{{/if}}

{{#if context === 'library'}}
   **API Safety**
   - Prototype pollution via object merge/spread
   - ReDoS (Regular Expression Denial of Service)
   - Resource exhaustion (unbounded recursion, memory)
   - Unsafe defaults that consumers might not override

   **Dependency Hygiene**
   - Minimal dependency surface
   - Pinned versions vs floating ranges
   - Known vulnerability in transitive deps
{{/if}}

{{#if context === 'worker'}}
   **Isolation**
   - Message validation from untrusted sources
   - Resource limits (memory, CPU, network)
   - Sandboxing of processed content

   **Data Handling**
   - Sensitive data in logs or error messages
   - Secure cleanup of temporary data
   - Encryption at rest for queued items
{{/if}}

5. **Secrets scan**
   Search for patterns indicating leaked secrets:
   - API keys: strings matching `[A-Za-z0-9]{32,}`  near assignment to vars like `apiKey`, `secret`, `token`
   - Connection strings: `postgres://`, `mongodb://`, `redis://` with embedded credentials
   - Private keys: `-----BEGIN (RSA |EC )?PRIVATE KEY-----`
   - Environment variable references that should be used instead of inline values

## Output Format

```
### Security Audit: {{targetPath}}

**Risk Level**: critical | high | medium | low | clean
**Context**: {{context}}

**Critical Findings** (immediate action required):
1. [CVE/CWE ref if applicable] <title>
   - **Location**: <file>:<line>
   - **Vulnerability**: <description>
   - **Exploit Scenario**: <how an attacker could exploit this>
   - **Remediation**: <specific fix with code>

**High-Risk Findings**:
...

**Medium-Risk Findings**:
...

**Recommendations**:
- <proactive hardening suggestions>

**Clean Areas**:
- <areas that passed security review — builds confidence>
```
