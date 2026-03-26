Generate tests for `{{sourceFile}}` targeting **{{coverage}}** coverage.

## Steps

1. **Read the source file**
   Use `file:read` to load `{{sourceFile}}`. Identify:
   - Exported functions, classes, and their public APIs
   - Input types and return types
   - Side effects (I/O, mutations, external calls)
   - Error handling paths

2. **Discover existing tests**
   Use `test:discover` to check for existing test files covering this module. Avoid duplicating coverage.

{{#if framework}}
3. **Use framework**: Write tests using **{{framework}}**.
{{else}}
3. **Detect framework**: Check project config files to determine the test framework. Fall back to `{{config.defaultFramework}}` if ambiguous.
{{/if}}

4. **Generate test cases**

   For **critical-paths** coverage:
   - Happy path for each exported function
   - Primary error/edge cases
   - Boundary conditions for numeric inputs

   For **comprehensive** coverage:
   - All of the above, plus:
   - Every branching path (if/else, switch cases)
   - Null/undefined input handling
   - Async behavior (resolved and rejected)
   - Integration points (mocked external dependencies)

   For **edge-cases** coverage:
   - Empty inputs, zero-length arrays, empty strings
   - Maximum/minimum values
   - Concurrent access patterns
   - Unicode and special characters
   - Type coercion traps

5. **Write the test file**
   - Group tests in `describe` blocks matching the source structure
   - Use descriptive test names: `it('returns empty array when input is empty')`
   - Keep each test focused on one assertion
   - Set up and tear down shared state properly
   - Mock external dependencies, never real I/O

## Output Format

Return the complete test file content, ready to save. Include:
- Import statements
- All test suites and cases
- Inline comments only where the test intent isn't obvious from the name
