/**
 * OTLP HTTP Trace Collector — receives OpenTelemetry spans and stores them
 * in our SQLite `traces` + `spans` tables.
 *
 * POST /v1/traces — accepts OTLP JSON (application/json)
 *
 * The Copilot CLI exports spans here when started with
 *   --otlpEndpoint http://localhost:3001
 */

import type { FastifyPluginAsync } from 'fastify';

// ── OTLP JSON wire types ─────────────────────────────────────────

interface OtlpAttributeValue {
  stringValue?: string;
  intValue?: string | number;
  doubleValue?: number;
  boolValue?: boolean;
  arrayValue?: { values: OtlpAttributeValue[] };
}

interface OtlpKeyValue {
  key: string;
  value: OtlpAttributeValue;
}

interface OtlpSpanEvent {
  timeUnixNano?: string;
  name: string;
  attributes?: OtlpKeyValue[];
}

interface OtlpSpanStatus {
  code?: number; // 0=UNSET, 1=OK, 2=ERROR
  message?: string;
}

interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind?: number; // 0=UNSPECIFIED, 1=INTERNAL, 2=SERVER, 3=CLIENT, 4=PRODUCER, 5=CONSUMER
  startTimeUnixNano: string;
  endTimeUnixNano?: string;
  attributes?: OtlpKeyValue[];
  status?: OtlpSpanStatus;
  events?: OtlpSpanEvent[];
}

interface OtlpScopeSpans {
  scope?: { name?: string; version?: string };
  spans: OtlpSpan[];
}

interface OtlpResourceSpans {
  resource?: { attributes?: OtlpKeyValue[] };
  scopeSpans: OtlpScopeSpans[];
}

interface OtlpExportTraceRequest {
  resourceSpans: OtlpResourceSpans[];
}

// ── Helpers ───────────────────────────────────────────────────────

const SPAN_KIND_MAP: Record<number, string> = {
  0: 'unspecified',
  1: 'internal',
  2: 'server',
  3: 'client',
  4: 'producer',
  5: 'consumer',
};

const STATUS_MAP: Record<number, string> = {
  0: 'unset',
  1: 'completed',
  2: 'error',
};

/** Convert OTLP attribute array to a flat JSON object. */
function flattenAttributes(attrs?: OtlpKeyValue[]): Record<string, unknown> {
  if (!attrs?.length) return {};
  const out: Record<string, unknown> = {};
  for (const { key, value } of attrs) {
    if (value.stringValue !== undefined) out[key] = value.stringValue;
    else if (value.intValue !== undefined) out[key] = Number(value.intValue);
    else if (value.doubleValue !== undefined) out[key] = value.doubleValue;
    else if (value.boolValue !== undefined) out[key] = value.boolValue;
    else if (value.arrayValue)
      out[key] = value.arrayValue.values.map((v) => v.stringValue ?? v.intValue ?? v.doubleValue);
  }
  return out;
}

/** Convert nanosecond timestamp string to epoch milliseconds. */
function nanoToMs(nanos?: string): number {
  if (!nanos) return Date.now();
  return Math.floor(Number(BigInt(nanos) / BigInt(1_000_000)));
}

/**
 * Detect semantic span kind from attributes.
 * OTel numeric kinds (0–5) don't represent tool/llm/agent;
 * we infer semantic kind from well-known attribute keys.
 */
function detectSemanticKind(
  attrs: Record<string, unknown>,
  spanName: string,
  otelKind?: number,
): string {
  // If an instrumentation explicitly set a kind string, use it directly
  if (typeof attrs['openai.kind'] === 'string') return attrs['openai.kind'];

  // Tool detection
  if (attrs['tool.name'] != null || attrs['tool.id'] != null) return 'tool';

  // LLM detection
  if (
    attrs['llm.model'] != null ||
    attrs['gen_ai.request.model'] != null ||
    attrs['ai.model'] != null
  )
    return 'llm';

  // Agent detection
  if (attrs['ai.agent_id'] != null || spanName.startsWith('agent:')) return 'agent';

  // Fallback to numeric OTel kind
  return SPAN_KIND_MAP[otelKind ?? 0] ?? 'internal';
}

/** Convert OTLP events to our JSON events format. */
function mapEvents(events?: OtlpSpanEvent[]): string {
  if (!events?.length) return '[]';
  return JSON.stringify(
    events.map((e) => ({
      name: e.name,
      timestamp: e.timeUnixNano ? nanoToMs(e.timeUnixNano) : undefined,
      attributes: flattenAttributes(e.attributes),
    })),
  );
}

// ── Route ─────────────────────────────────────────────────────────

const otlpCollectorRoute: FastifyPluginAsync = async (app) => {
  app.post('/v1/traces', async (request, reply) => {
    const body = request.body as OtlpExportTraceRequest | undefined;

    if (!body?.resourceSpans?.length) {
      return reply.status(200).send({ partialSuccess: {} });
    }

    const traceService = app.traceService;
    let ingested = 0;

    for (const rs of body.resourceSpans) {
      const resourceAttrs = flattenAttributes(rs.resource?.attributes);

      for (const ss of rs.scopeSpans) {
        const scopeName = ss.scope?.name;

        for (const otlpSpan of ss.spans) {
          try {
            const startMs = nanoToMs(otlpSpan.startTimeUnixNano);
            const endMs = otlpSpan.endTimeUnixNano ? nanoToMs(otlpSpan.endTimeUnixNano) : undefined;
            const durationMs = endMs !== undefined ? endMs - startMs : undefined;
            const status = STATUS_MAP[otlpSpan.status?.code ?? 0] ?? 'unset';

            // Merge resource + span attributes + scope info
            const attrs: Record<string, unknown> = {
              ...resourceAttrs,
              ...flattenAttributes(otlpSpan.attributes),
            };
            if (scopeName) attrs['otel.scope.name'] = scopeName;
            attrs['otel.source'] = 'otlp-collector';

            // Auto-detect semantic kind from attributes (overrides numeric OTel kind)
            const kind = detectSemanticKind(attrs, otlpSpan.name, otlpSpan.kind);

            // Ensure the parent trace row exists
            traceService.ensureTrace({
              traceId: otlpSpan.traceId,
              spanName: otlpSpan.name,
              startTime: startMs,
              agentName: (attrs['ai.agent_id'] as string) ?? null,
            });

            // Insert the span (idempotent — skips duplicates)
            traceService.upsertSpan({
              id: otlpSpan.spanId,
              trace_id: otlpSpan.traceId,
              parent_span_id: otlpSpan.parentSpanId || null,
              name: otlpSpan.name,
              kind,
              status,
              start_time: startMs,
              end_time: endMs ?? null,
              duration_ms: durationMs ?? null,
              attributes: JSON.stringify(attrs),
              events: mapEvents(otlpSpan.events),
            });

            // Update the trace-level aggregates
            traceService.refreshTraceAggregates(otlpSpan.traceId);

            ingested++;
          } catch (err) {
            request.log.warn({ err, spanId: otlpSpan.spanId }, 'Failed to ingest OTLP span');
          }
        }
      }
    }

    request.log.info(`[OTLP] Ingested ${ingested} spans`);

    // OTLP success response
    return reply.status(200).send({ partialSuccess: {} });
  });
};

export default otlpCollectorRoute;
