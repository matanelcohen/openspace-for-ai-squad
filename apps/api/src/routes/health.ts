import type { FastifyPluginAsync } from 'fastify';

const healthRoute: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => {
    return { status: 'ok' as const, timestamp: new Date().toISOString() };
  });

  app.get('/config', async () => {
    const aiProvider = (app as Record<string, unknown>).voiceServices
      ? ((app as Record<string, unknown>).voiceServices as Record<string, unknown>).aiProvider
      : undefined;

    const providerName = aiProvider?.constructor?.name ?? 'unknown';
    const isCopilotConnected = providerName === 'CopilotProvider';
    const isMock = providerName === 'MockAIProvider';

    const config: Record<string, unknown> = {
      model: process.env.COPILOT_MODEL ?? 'claude-opus-4.6',
      fallbackModel: process.env.COPILOT_FALLBACK_MODEL ?? null,
      cliUrl: process.env.COPILOT_CLI_URL ?? null,
      copilotConnected: isCopilotConnected,
      providerType: isMock ? 'mock' : 'copilot-sdk',
      failoverActive: false,
    };

    // Get counts
    try {
      const agentCount = app.db?.prepare?.('SELECT COUNT(*) as cnt FROM team_members')?.get() as { cnt: number } | undefined;
      config.agentCount = agentCount?.cnt ?? 0;
    } catch { config.agentCount = 0; }

    try {
      const skillCount = app.skillRegistry?.size ?? 0;
      config.skillCount = skillCount;
    } catch { config.skillCount = 0; }

    return config;
  });
};

export default healthRoute;
