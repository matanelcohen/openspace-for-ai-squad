/** Trace & Span types for the trace viewer */

export type SpanKind =
  | 'agent'
  | 'chain'
  | 'tool'
  | 'llm'
  | 'retriever'
  | 'embedding'
  | 'internal'
  | 'reasoning'
  | 'server'
  | 'client'
  | 'unspecified';
export type TraceStatus = 'success' | 'error' | 'running' | 'pending';

export interface Span {
  id: string;
  traceId: string;
  parentId: string | null;
  name: string;
  kind: SpanKind;
  status: TraceStatus;
  startTime: number; // ms timestamp
  endTime: number | null; // null if still running
  duration: number | null; // ms
  input: unknown;
  output: unknown;
  error: string | null;
  tokens: { prompt: number; completion: number; total: number } | null;
  cost: number | null; // USD
  model: string | null;
  toolName: string | null;
  provider: string | null;
  inputPreview: string | null;
  outputPreview: string | null;
  metadata: Record<string, unknown>;
  children: Span[];
}

export interface Trace {
  id: string;
  name: string;
  agentName: string;
  status: TraceStatus;
  startTime: number;
  endTime: number | null;
  duration: number | null;
  totalTokens: number;
  totalCost: number;
  spanCount: number;
  errorCount: number;
  rootSpan: Span;
}

export interface TraceSummary {
  id: string;
  name: string;
  agentName: string;
  status: TraceStatus;
  startTime: number;
  duration: number | null;
  totalTokens: number;
  totalCost: number;
  spanCount: number;
  errorCount: number;
}

export interface TraceStats {
  totalTraces: number;
  avgLatency: number;
  totalCost: number;
  totalTokens: number;
  errorRate: number;
  latencyDistribution: { bucket: string; count: number }[];
  costOverTime: { date: string; cost: number }[];
  tokenUsage: { date: string; prompt: number; completion: number }[];
  errorsByAgent: { agent: string; errors: number; total: number }[];
  tracesByAgent: { agent: string; count: number }[];
}
