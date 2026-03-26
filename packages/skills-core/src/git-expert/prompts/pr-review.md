Review the pull request merging `{{headBranch}}` into `{{baseBranch}}`.

## Steps

1. **Get the full diff**
   Use `git:diff` with target `{{baseBranch}}...{{headBranch}}` to see all changes introduced by this PR.

2. **Review commit history**
   Use `git:log` for the range `{{baseBranch}}..{{headBranch}}` to understand how the work was structured. Check for:
   - Logical commit progression
   - Meaningful commit messages
   - Any fixup/squash candidates

3. **Analyze each changed file**
   For every file in the diff:
   - **Correctness**: Logic errors, null checks, boundary conditions
   - **Security**: Injection vectors, auth bypasses, secret exposure, unsafe deserialization
   - **Performance**: N+1 queries, unnecessary allocations, missing indexes
   - **Style**: Consistency with surrounding code (not nitpicking — only flag deviations that hurt readability)
   - **Tests**: Are new code paths covered? Are existing tests updated for changed behavior?

{{#if focusAreas}}
4. **Focus areas**: Pay special attention to: {{focusAreas}}
{{/if}}

5. **Check for missing pieces**
   - Documentation updates needed?
   - Migration scripts for schema changes?
   - Config/environment variable additions?
   - Changelog entry?

6. **Blame context**
   Use `git:blame` on modified sections to understand surrounding code history. Flag if changes conflict with recent work by other authors.

## Output Format

```
### PR Review: {{headBranch}} → {{baseBranch}}

**Verdict**: approve | request-changes | comment

**Summary**: <2-3 sentence overview>

**Critical Issues** (must fix):
- [ ] ...

**Suggestions** (should consider):
- [ ] ...

**Nits** (optional):
- [ ] ...

**Files Reviewed**: <count>/<total>
```

## Guidelines

- Be specific: cite file paths, line numbers, and code snippets.
- Distinguish blocking issues from suggestions.
- Acknowledge good patterns — reinforce what works.
- If the diff is clean, say so. Don't manufacture issues.
