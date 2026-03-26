Analyze the commit(s) at `{{commitRef}}` with {{depth}} commits of parent context.

## Steps

1. **Retrieve the commit(s)**
   Use `git:log` to fetch the commit at `{{commitRef}}` plus {{depth}} parent commits for context.

2. **Inspect the diff**
   Use `git:diff` to get the full changeset. If the diff exceeds {{config.maxDiffLines}} lines, summarize by file and highlight the most significant hunks.

3. **Assess the change**
   For each modified file, evaluate:
   - **Intent**: What is the commit trying to accomplish?
   - **Correctness**: Are there logic errors, off-by-ones, or missed edge cases?
   - **Completeness**: Are related files (tests, docs, configs) updated accordingly?
   - **Risk**: Could this change break existing behavior? Check blame history with `git:blame` for recently-modified hot spots.

4. **Trace authorship** (if relevant)
   Use `git:blame` on critical sections to understand who owns the surrounding code and whether the change aligns with recent patterns.

## Output Format

```
### Commit Analysis: {{commitRef}}

**Summary**: <one-line description of the change>

**Files Changed**: <count>
| File | Change Type | Risk |
|------|------------|------|
| ... | added/modified/deleted | low/medium/high |

**Key Findings**:
1. ...
2. ...

**Recommendations**:
- ...
```
