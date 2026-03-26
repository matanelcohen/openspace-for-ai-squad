Update the documentation at `{{docPath}}` to reflect recent code changes.

**Change summary**: {{changeSummary}}

## Steps

1. **Read the existing documentation**
   Use `file:read` to load the current content of `{{docPath}}`. Understand its structure, sections, and coverage.

2. **Read relevant source files**
   Based on the change summary, use `file:read` to inspect the modified source files. Focus on:
   - New or changed public APIs (function signatures, types, exports)
   - Modified behavior or configuration options
   - Added or removed dependencies

3. **Identify documentation gaps**
   Compare the existing docs against the current source code:
   - **Outdated**: Sections that describe behavior that has changed
   - **Missing**: New APIs, options, or features not yet documented
   - **Removed**: Documentation for code that no longer exists

4. **Check recent history** (if helpful)
   Use `git:log` to review recent commits touching the documented module. This provides context on what changed and why.

5. **Apply updates**
   Use `file:write` to update `{{docPath}}` with the necessary changes.

{{#if (eq preserveStructure "true")}}
   **Preserve the existing document structure.** Update content within existing sections rather than reorganizing. Only add new sections if the changes introduce entirely new concepts.
{{else}}
   Restructure the document if the changes warrant it. Ensure the final structure is logical and complete.
{{/if}}

## Output Format

After updating, provide a summary:

```
### Documentation Update: {{docPath}}

**Sections Updated**:
- <section name>: <what changed>

**Sections Added**:
- <section name>: <why it was needed>

**Sections Removed**:
- <section name>: <why it was removed>

**Confidence**: high | medium | low
<If medium/low, explain what couldn't be verified from source>
```

## Guidelines

- Every documentation change must be traceable to actual source code.
- Don't remove content unless the corresponding code is genuinely gone.
- Flag uncertainty — if you can't verify a behavior from source, note it explicitly.
- Keep examples working: update code snippets to match current APIs.
- Preserve voice and formatting conventions already established in the doc.
