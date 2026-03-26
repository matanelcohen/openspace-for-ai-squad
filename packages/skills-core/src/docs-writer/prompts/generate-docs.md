Generate {{docType}} documentation for `{{targetPath}}`, targeting a **{{audience}}** audience.

## Steps

1. **Discover project structure**
   Use `file:list` to understand the layout of `{{targetPath}}`. Identify source files, existing docs, config files, and test directories.

2. **Read source files**
   Use `file:read` on key source files (entry points, public APIs, main modules). Limit reads to {{config.maxFileReadSize}} lines per file — focus on exports, type definitions, and public interfaces.

3. **Check existing documentation**
   Use `file:read` to load any existing README, CHANGELOG, or doc files. Note what's already covered and what's missing or outdated.

4. **Analyze and synthesize**
   From the source code, extract:
   - **Purpose**: What does this code do and why does it exist?
   - **Public API**: Exported functions, classes, types, and their signatures
   - **Dependencies**: Key external and internal dependencies
   - **Configuration**: Environment variables, config files, or options
   - **Patterns**: Notable design patterns or conventions used

{{#if config.includeExamples}}
5. **Generate usage examples**
   Write realistic code examples showing common usage patterns. Examples must be based on actual APIs found in the source — never invent function signatures.
{{/if}}

6. **Write documentation**
   Use `file:write` to create the documentation file in {{config.outputFormat}} format.

## Output Format

{{#if (eq docType "readme")}}
```markdown
# <Project/Module Name>

<One-paragraph description>

## Getting Started

### Prerequisites
- ...

### Installation
...

### Quick Start
...

## API Reference

### `functionName(params): ReturnType`
<description>

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| ... | ...  | ...     | ...         |

## Contributing
...
```
{{/if}}

{{#if (eq docType "api-reference")}}
```markdown
# API Reference: <Module Name>

## Overview
<Brief description of the module's purpose>

## Functions

### `functionName(params): ReturnType`
<Description>

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| ...  | ...  | ...      | ...         |

**Returns:** `ReturnType` — <description>

**Example:**
```ts
// usage example
```

## Types

### `TypeName`
<Description and shape>
```
{{/if}}

{{#if (eq docType "architecture")}}
```markdown
# Architecture: <Component Name>

## Overview
<High-level description of the component and its role in the system>

## Key Components
- **Component A**: <purpose>
- **Component B**: <purpose>

## Data Flow
<Describe how data moves through the system>

## Design Decisions
- **Decision**: <rationale>

## Dependencies
- <dependency>: <why it's used>
```
{{/if}}

## Guidelines

- Be precise: reference actual file paths, function names, and types from the source.
- Keep it scannable: use headers, tables, and code blocks.
- Don't pad with filler — if a section isn't relevant, omit it.
- Match the tone to the audience: technical depth for contributors, simplicity for end-users.
