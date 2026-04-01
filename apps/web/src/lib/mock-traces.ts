/**
 * Mock trace data generator for development.
 * Produces realistic trace hierarchies with agent → chain → tool/LLM spans.
 */
import type {
  LlmInfo,
  Span,
  SpanEvent,
  SpanKind,
  ToolInfo,
  Trace,
  TraceStats,
  TraceStatus,
  TraceSummary,
} from './trace-types';

let nextId = 1;
const id = () => `span-${nextId++}`;

const AGENT_NAMES = ['Fry', 'Leela', 'Bender', 'Professor', 'Zoidberg'];
const TOOL_NAMES = [
  'web_search',
  'code_interpreter',
  'file_reader',
  'sql_query',
  'api_call',
  'image_gen',
];
const MODELS = ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4', 'claude-haiku-4'];
const CHAIN_NAMES = [
  'Plan & Execute',
  'ReAct Loop',
  'Tool Selection',
  'Response Synthesis',
  'Memory Retrieval',
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeSpan(
  traceId: string,
  parentId: string | null,
  name: string,
  kind: SpanKind,
  startTime: number,
  duration: number,
  status: TraceStatus = 'success',
  children: Span[] = [],
): Span {
  const isLlm = kind === 'llm';
  const promptTokens = isLlm ? randomInt(200, 4000) : 0;
  const completionTokens = isLlm ? randomInt(50, 2000) : 0;
  const totalTokens = promptTokens + completionTokens;
  const model = isLlm ? randomChoice(MODELS) : null;
  const costPerToken = model?.includes('gpt-4o-mini')
    ? 0.00000015
    : model?.includes('haiku')
      ? 0.00000025
      : 0.0000025;

  const isTool = kind === 'tool';
  const toolNameValue = isTool ? name : null;
  const toolIdValue = isTool ? `tool-${name.replace(/\s+/g, '-').toLowerCase()}` : null;

  const events: SpanEvent[] = [];
  if (isTool) {
    events.push({
      name: 'tool.start',
      timestamp: startTime,
      attributes: { toolName: name },
    });
    events.push({
      name: 'tool.end',
      timestamp: startTime + duration,
    });
  }
  if (isLlm) {
    events.push({
      name: 'llm.request',
      timestamp: startTime,
      attributes: { model: model ?? 'unknown' },
    });
  }

  const toolInfo: ToolInfo | null = isTool
    ? {
        durationMs: duration,
        parameterCount: 1,
        inputBytes: JSON.stringify({ query: `Input for ${name}` }).length,
        outputBytes:
          status === 'error' ? null : JSON.stringify({ result: `Output from ${name}` }).length,
        customAttributes: { toolVersion: '1.2.0' },
      }
    : null;

  const llmInfo: LlmInfo | null = isLlm
    ? {
        messageCount: 1,
        responseLength: status === 'error' ? null : 'Generated response text...'.length,
        tokensPerSecond:
          completionTokens > 0 && duration > 0
            ? Math.round((completionTokens / (duration / 1000)) * 100) / 100
            : null,
      }
    : null;

  return {
    id: id(),
    traceId,
    parentId,
    name,
    kind,
    status,
    startTime,
    endTime: startTime + duration,
    duration,
    input:
      kind === 'llm'
        ? { messages: [{ role: 'user', content: 'Sample prompt...' }] }
        : { query: `Input for ${name}` },
    output:
      status === 'error'
        ? null
        : kind === 'llm'
          ? { content: 'Generated response text...' }
          : { result: `Output from ${name}` },
    error: status === 'error' ? `${name} failed: timeout after ${duration}ms` : null,
    tokens: isLlm
      ? { prompt: promptTokens, completion: completionTokens, total: totalTokens }
      : null,
    cost: isLlm ? totalTokens * costPerToken : null,
    model,
    metadata: kind === 'tool' ? { toolVersion: '1.2.0' } : {},
    children,
    toolName: toolNameValue,
    toolId: toolIdValue,
    events,
    toolInfo,
    llmInfo,
  };
}

function generateTrace(index: number): Trace {
  const traceId = `trace-${1000 + index}`;
  const agentName = AGENT_NAMES[index % AGENT_NAMES.length]!;
  const now = Date.now();
  const startTime = now - randomInt(60_000, 7_200_000);
  const hasError = index % 7 === 0;
  const isRunning = index === 0;

  // Build span hierarchy: agent → chains → (tool + llm calls)
  const agentSpanId = id();
  const chains: Span[] = [];
  let cursor = startTime + randomInt(5, 20);

  const chainCount = randomInt(1, 3);
  for (let c = 0; c < chainCount; c++) {
    const chainStart = cursor;
    const chainChildren: Span[] = [];

    // Each chain has 1-3 steps of tool+llm pairs (some parallel)
    const stepCount = randomInt(1, 3);
    let stepCursor = chainStart + randomInt(2, 10);

    for (let s = 0; s < stepCount; s++) {
      const llmDuration = randomInt(200, 3000);
      const llmSpan = makeSpan(
        traceId,
        '', // will set parent after
        `${randomChoice(MODELS)} call`,
        'llm',
        stepCursor,
        llmDuration,
        hasError && c === chainCount - 1 && s === stepCount - 1 ? 'error' : 'success',
      );

      // Some steps have parallel tool calls before the LLM
      const hasParallelTools = Math.random() > 0.4;
      if (hasParallelTools) {
        const toolCount = randomInt(1, 3);
        const toolStart = stepCursor;
        let maxToolEnd = toolStart;
        for (let t = 0; t < toolCount; t++) {
          const toolDuration = randomInt(50, 800);
          const toolSpan = makeSpan(
            traceId,
            '',
            randomChoice(TOOL_NAMES),
            'tool',
            toolStart + randomInt(0, 30), // slight offset for parallel
            toolDuration,
          );
          chainChildren.push(toolSpan);
          maxToolEnd = Math.max(maxToolEnd, toolSpan.endTime!);
        }
        // LLM starts after tools finish
        llmSpan.startTime = maxToolEnd + randomInt(2, 10);
        llmSpan.endTime = llmSpan.startTime + llmDuration;
      }

      chainChildren.push(llmSpan);
      stepCursor = (llmSpan.endTime ?? llmSpan.startTime + llmDuration) + randomInt(5, 30);
    }

    const chainEnd = stepCursor;
    const chainSpan = makeSpan(
      traceId,
      agentSpanId,
      randomChoice(CHAIN_NAMES),
      'chain',
      chainStart,
      chainEnd - chainStart,
      hasError && c === chainCount - 1 ? 'error' : 'success',
      chainChildren,
    );

    // Set parentIds for children
    chainChildren.forEach((child) => {
      child.parentId = chainSpan.id;
    });

    chains.push(chainSpan);
    cursor = chainEnd + randomInt(10, 50);
  }

  const totalDuration = isRunning ? null : cursor - startTime;
  const endTime = isRunning ? null : startTime + (totalDuration ?? 0);
  const status: TraceStatus = isRunning ? 'running' : hasError ? 'error' : 'success';

  const rootSpan: Span = {
    id: agentSpanId,
    traceId,
    parentId: null,
    name: `${agentName} Agent Run`,
    kind: 'agent',
    status,
    startTime,
    endTime,
    duration: totalDuration,
    input: { task: `Task #${1000 + index}: Process user request` },
    output: status === 'error' ? null : { result: 'Task completed successfully' },
    error: null,
    tokens: null,
    cost: null,
    model: null,
    metadata: { agentVersion: '2.1.0' },
    children: chains,
    toolName: null,
    toolId: null,
    events: [{ name: 'agent.start', timestamp: startTime }],
    toolInfo: null,
    llmInfo: null,
  };

  // Collect all spans for counting
  const allSpans: Span[] = [];
  function collectSpans(span: Span) {
    allSpans.push(span);
    span.children.forEach(collectSpans);
  }
  collectSpans(rootSpan);

  const totalTokens = allSpans.reduce((sum, s) => sum + (s.tokens?.total ?? 0), 0);
  const totalCost = allSpans.reduce((sum, s) => sum + (s.cost ?? 0), 0);
  const errorCount = allSpans.filter((s) => s.status === 'error').length;

  return {
    id: traceId,
    name: `${agentName} Agent Run`,
    agentName,
    status,
    startTime,
    endTime,
    duration: totalDuration,
    totalTokens,
    totalCost,
    spanCount: allSpans.length,
    errorCount,
    rootSpan,
  };
}

// Generate stable mock data
const MOCK_TRACES: Trace[] = Array.from({ length: 50 }, (_, i) => generateTrace(i));

export function getMockTraces(): TraceSummary[] {
  return MOCK_TRACES.map(({ rootSpan: _, ...summary }) => summary as TraceSummary);
}

export function getMockTrace(traceId: string): Trace | undefined {
  return MOCK_TRACES.find((t) => t.id === traceId);
}

export function getMockTraceStats(): TraceStats {
  const traces = MOCK_TRACES;
  const completedTraces = traces.filter((t) => t.duration != null);
  const totalTraces = traces.length;
  const avgLatency =
    completedTraces.length > 0
      ? completedTraces.reduce((sum, t) => sum + (t.duration ?? 0), 0) / completedTraces.length
      : 0;
  const totalCost = traces.reduce((sum, t) => sum + t.totalCost, 0);
  const totalTokens = traces.reduce((sum, t) => sum + t.totalTokens, 0);
  const errorTraces = traces.filter((t) => t.status === 'error').length;
  const errorRate = totalTraces > 0 ? errorTraces / totalTraces : 0;

  // Latency distribution buckets
  const buckets = ['<1s', '1-2s', '2-5s', '5-10s', '>10s'];
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0;
  completedTraces.forEach((t) => {
    const d = (t.duration ?? 0) / 1000;
    if (d < 1) b0++;
    else if (d < 2) b1++;
    else if (d < 5) b2++;
    else if (d < 10) b3++;
    else b4++;
  });

  // Cost over last 7 days
  const now = Date.now();
  const costOverTime = Array.from({ length: 7 }, (_, i) => {
    const dayStart = now - (6 - i) * 86_400_000;
    const dayEnd = dayStart + 86_400_000;
    const dayCost = traces
      .filter((t) => t.startTime >= dayStart && t.startTime < dayEnd)
      .reduce((sum, t) => sum + t.totalCost, 0);
    return {
      date: new Date(dayStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      cost: Math.round(dayCost * 10000) / 10000,
    };
  });

  // Token usage over last 7 days
  const tokenUsage = Array.from({ length: 7 }, (_, i) => {
    const dayStart = now - (6 - i) * 86_400_000;
    const dayEnd = dayStart + 86_400_000;
    const dayTraces = traces.filter((t) => t.startTime >= dayStart && t.startTime < dayEnd);

    function sumTokens(span: Span): { prompt: number; completion: number } {
      const self = span.tokens ?? { prompt: 0, completion: 0 };
      const childSums = span.children.reduce(
        (acc, c) => {
          const cs = sumTokens(c);
          return { prompt: acc.prompt + cs.prompt, completion: acc.completion + cs.completion };
        },
        { prompt: 0, completion: 0 },
      );
      return {
        prompt: self.prompt + childSums.prompt,
        completion: self.completion + childSums.completion,
      };
    }

    // For token usage we need the full traces with rootSpan
    const fullTraces = dayTraces
      .map((t) => MOCK_TRACES.find((mt) => mt.id === t.id))
      .filter(Boolean) as Trace[];
    const totals = fullTraces.reduce(
      (acc, t) => {
        const s = sumTokens(t.rootSpan);
        return { prompt: acc.prompt + s.prompt, completion: acc.completion + s.completion };
      },
      { prompt: 0, completion: 0 },
    );

    return {
      date: new Date(dayStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      prompt: totals.prompt,
      completion: totals.completion,
    };
  });

  // Errors by agent
  const agentMap = new Map<string, { errors: number; total: number }>();
  traces.forEach((t) => {
    const entry = agentMap.get(t.agentName) ?? { errors: 0, total: 0 };
    entry.total++;
    if (t.status === 'error') entry.errors++;
    agentMap.set(t.agentName, entry);
  });

  // Traces by agent
  const tracesByAgent = Array.from(agentMap.entries()).map(([agent, data]) => ({
    agent,
    count: data.total,
  }));

  return {
    totalTraces,
    avgLatency,
    totalCost,
    totalTokens,
    errorRate,
    latencyDistribution: buckets.map((bucket, i) => ({
      bucket,
      count: [b0, b1, b2, b3, b4][i] ?? 0,
    })),
    costOverTime,
    tokenUsage,
    errorsByAgent: Array.from(agentMap.entries()).map(([agent, data]) => ({
      agent,
      ...data,
    })),
    tracesByAgent,
  };
}
