Diagnose failing tests and identify root causes.

## Input

**Test Output**:
```
{{testOutput}}
```

{{#if testFile}}
**Failing Test File**: `{{testFile}}`
{{/if}}

{{#if recentChanges}}
**Recent Changes**:
```
{{recentChanges}}
```
{{/if}}

## Steps

1. **Parse failures**
   Extract from the test output:
   - Which tests failed (names, files, line numbers)
   - Error messages and assertion mismatches
   - Stack traces pointing to source code

2. **Read the failing test(s)**
   {{#if testFile}}
   Use `file:read` to load `{{testFile}}`.
   {{else}}
   Use `file:read` to load each failing test file identified in step 1.
   {{/if}}
   Understand what each test expects and how it sets up state.

3. **Read the source under test**
   Follow imports from the test file to the source code. Read the relevant functions/methods.

4. **Classify the failure**

   | Category | Symptoms |
   |----------|----------|
   | **Logic bug** | Assertion mismatch, wrong return value |
   | **Type error** | Property access on undefined, type mismatch |
   | **Async issue** | Timeout, unresolved promise, race condition |
   | **Environment** | Missing env var, file not found, port conflict |
   | **Test isolation** | Passes alone but fails in suite (shared state leak) |
   | **Flaky** | Intermittent failure, timing-dependent |
   | **Stale test** | Test expectations don't match updated code |

{{#if recentChanges}}
5. **Correlate with recent changes**
   Compare the failing code paths against the recent changes. Determine if a change directly caused the failure or exposed a pre-existing issue.
{{/if}}

6. **Propose fix**
   For each failure, recommend:
   - Whether to fix the **source code** or the **test**
   - The specific change needed (with code snippet)
   - Confidence level (certain / likely / speculative)

## Output Format

```
### Test Failure Analysis

**Summary**: <X> test(s) failing, <Y> root cause(s) identified

#### Failure 1: <test name>
- **File**: <path>:<line>
- **Category**: <from table above>
- **Root Cause**: <explanation>
- **Fix**: <code change or test update>
- **Confidence**: certain | likely | speculative

...
```
