Build a threat model for the component at `{{componentPath}}` using the **{{framework}}** framework.

{{#if attackSurface}}
**Focus areas**: {{attackSurface}}
{{/if}}

## Steps

1. **Understand the component**
   Use `file:list` to discover the structure of `{{componentPath}}`. Then use `file:read` on key files to understand:
   - What the component does (purpose and scope)
   - External interfaces (APIs, message queues, file I/O, network)
   - Data it processes (types, sensitivity, flow direction)
   - Dependencies it relies on
   - Authentication and authorization mechanisms

2. **Identify trust boundaries**
   Map where data crosses trust boundaries:
   - Client → Server
   - Service → Service
   - Application → Database
   - User input → File system
   - Internal network → External network

3. **Enumerate threats using {{framework}}**

{{#if (eq framework "stride")}}
   Apply the STRIDE model to each component and trust boundary:
   - **Spoofing**: Can an attacker impersonate a user or component?
   - **Tampering**: Can data be modified in transit or at rest?
   - **Repudiation**: Can actions be performed without proper audit trail?
   - **Information Disclosure**: Can sensitive data leak through errors, logs, or side channels?
   - **Denial of Service**: Can the component be overwhelmed or crashed?
   - **Elevation of Privilege**: Can an attacker gain higher access than intended?
{{/if}}

{{#if (eq framework "dread")}}
   Score each threat using DREAD:
   - **Damage**: How severe is the impact? (1-10)
   - **Reproducibility**: How easy to reproduce? (1-10)
   - **Exploitability**: How easy to exploit? (1-10)
   - **Affected Users**: How many users impacted? (1-10)
   - **Discoverability**: How easy to discover? (1-10)
{{/if}}

{{#if (eq framework "attack-tree")}}
   Build an attack tree with:
   - **Root goal**: What the attacker wants to achieve
   - **Sub-goals**: Steps needed to reach the root goal
   - **Leaf nodes**: Specific techniques or exploits
   - **AND/OR**: Whether all sub-goals or just one is needed
{{/if}}

4. **Assess existing mitigations**
   Use `file:read` and `static-analysis:scan` to check which threats already have mitigations in the code:
   - Input validation and sanitization
   - Authentication and authorization checks
   - Encryption (in transit and at rest)
   - Rate limiting and resource controls
   - Logging and monitoring
   - Error handling (safe failure modes)

5. **Identify gaps**
   For each threat without adequate mitigation, determine:
   - Likelihood of exploitation (low/medium/high)
   - Business impact (low/medium/high/critical)
   - Recommended mitigation with implementation guidance

## Output Format

```
### Threat Model: {{componentPath}}

**Framework**: {{framework}}
**Component Purpose**: <one-line description>
**Attack Surface**: <summary of external interfaces>

---

#### Trust Boundaries

| Boundary | From | To | Data Types |
|----------|------|----|------------|
| ...      | ...  | .. | ...        |

---

#### Threat Analysis

##### T1: <Threat Name>
**Category**: <STRIDE category / DREAD score / Attack tree node>
**Trust Boundary**: <which boundary this affects>
**Description**: <how the attack works>
**Likelihood**: high | medium | low
**Impact**: critical | high | medium | low

**Current Mitigations**:
- <mitigation, if any>

**Gaps**:
- <what's missing>

**Recommended Fix**:
<specific implementation guidance>

---

### Risk Matrix

| Threat | Likelihood | Impact | Risk Level | Mitigated? |
|--------|-----------|--------|------------|------------|
| T1     | ...       | ...    | ...        | partial    |

### Top Priorities
1. <highest-risk unmitigated threat with recommended action>
2. ...
3. ...
```

## Guidelines

- Ground every threat in actual code — reference files, endpoints, and data flows.
- Don't list theoretical threats that don't apply to this component.
- Clearly distinguish between confirmed vulnerabilities and potential risks.
- Prioritize actionable recommendations over exhaustive enumeration.
- If attack surface areas are specified, focus depth there but still do a surface-level pass on the rest.
