Review `{{targetPath}}` for code quality issues at **{{strictness}}** strictness.

## Steps

1. **Read the target**
{{#if scope === 'diff'}}
   Use `git:diff` to get only the changed lines in `{{targetPath}}`. Focus review on new/modified code.
{{else}}
   Use `file:read` to load the full contents of `{{targetPath}}`. If it's a directory, use `file:list` to discover files, then read each.
{{/if}}

2. **Run linters**
   Use `lint:run` on `{{targetPath}}` to catch mechanical issues. Don't duplicate linter findings in your review — reference them.

3. **Query structure**
   Use `ast:query` to understand the code's architecture:
   - `functions` — identify overly complex functions (deep nesting, many params)
   - `classes` — check for god objects, missing encapsulation
   - `imports` — detect circular dependencies, unused imports
   - `exports` — verify public API surface is intentional

4. **Evaluate quality dimensions**

   **Correctness**
   - Logic errors, off-by-one, null/undefined access
   - Unhandled promise rejections or error paths
   - Race conditions in async code

   **Maintainability**
   - Functions over 50 lines → suggest extraction
   - Deep nesting (>3 levels) → suggest early returns or decomposition
   - Magic numbers/strings → suggest named constants
   - Duplicated logic → suggest shared utility

   **Performance** (at standard+ strictness)
   - Unnecessary re-computation inside loops
   - Missing memoization for expensive derivations
   - Unbounded data structures (arrays that grow without limit)

   **API Design** (at strict strictness)
   - Parameter count >4 → suggest options object
   - Missing input validation on public APIs
   - Leaky abstractions exposing internal details

{{#if config.securityEnabled}}
5. **Security quick-scan**
   Flag obvious security issues (detailed security review is in the security-check prompt):
   - Hardcoded credentials or API keys
   - SQL/command injection vectors
   - Unvalidated user input reaching sensitive operations
{{/if}}

## Output Format

```
### Code Quality Review: {{targetPath}}

**Overall**: good | acceptable | needs-work | poor

**Lint Summary**: <X> errors, <Y> warnings (auto-fixable: <Z>)

**Findings**:

#### [severity] Finding title
- **File**: <path>:<line>
- **Issue**: <what's wrong>
- **Impact**: <why it matters>
- **Fix**: <how to fix it>

...

**Positive Observations**:
- <what's done well — reinforce good patterns>
```

## Severity Levels

Only report findings at or above **{{config.severityThreshold}}** threshold:
- **critical**: Bugs, security vulnerabilities, data loss risks
- **error**: Logic errors, unhandled edge cases, broken contracts
- **warning**: Maintainability issues, performance concerns, code smells
- **info**: Suggestions, style improvements, minor readability tweaks
