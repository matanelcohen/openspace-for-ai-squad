/**
 * OpenTelemetry initialization — must be imported before any other modules.
 * Exports traces to the OTLP endpoint (default: http://localhost:4318).
 */

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

const otlpEndpoint =
  process.env.COPILOT_OTLP_ENDPOINT ?? `http://localhost:${process.env.API_PORT ?? 3001}`;

const sdk = new NodeSDK({
  serviceName: 'openspace-api',
  traceExporter: new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
  }),
});

sdk.start();

process.on('SIGTERM', () => sdk.shutdown());
process.on('SIGINT', () => sdk.shutdown());

console.log(`[OTel] Tracing initialized → ${otlpEndpoint}/v1/traces`);
