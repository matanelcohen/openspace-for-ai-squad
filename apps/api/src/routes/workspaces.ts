import type { FastifyPluginAsync } from 'fastify';

import type { WorkspaceService } from '../services/workspace/index.js';
import type { ChatService } from '../services/chat/index.js';
import type { AgentRegistry } from '../services/agent-registry.js';
import type { VoiceServices } from '../app.js';

interface InitSquadBody {
  teamName: string;
  description?: string;
  stack?: string;
  universe?: string;
  agents: Array<{ name: string; role: string; personality?: string; backstory?: string }>;
}

const workspacesRoute: FastifyPluginAsync = async (app) => {
  /** List all workspaces. */
  app.get('/workspaces', async (_request, reply) => {
    return reply.send(app.workspaceService.list());
  });

  /** Get the currently active workspace. */
  app.get('/workspaces/active', async (_request, reply) => {
    const active = app.workspaceService.getActive();
    if (!active) {
      return reply.status(404).send({ error: 'No active workspace' });
    }
    return reply.send(active);
  });

  /** Create a new workspace. */
  app.post<{
    Body: { name: string; projectDir: string; icon?: string };
  }>('/workspaces', async (request, reply) => {
    const { name, projectDir, icon } = request.body ?? {};
    if (!name || !projectDir) {
      return reply.status(400).send({ error: 'name and projectDir are required' });
    }
    const workspace = app.workspaceService.create({ name, projectDir, icon });
    return reply.status(201).send(workspace);
  });

  /** Update workspace metadata. */
  app.put<{
    Params: { id: string };
    Body: { name?: string; icon?: string; description?: string };
  }>('/workspaces/:id', async (request, reply) => {
    const workspace = app.workspaceService.update(request.params.id, request.body ?? {});
    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace not found' });
    }
    return reply.send(workspace);
  });

  /** Delete a workspace. */
  app.delete<{ Params: { id: string } }>('/workspaces/:id', async (request, reply) => {
    const deleted = app.workspaceService.delete(request.params.id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Workspace not found' });
    }
    return reply.send({ success: true });
  });

  /** Activate a workspace — reloads services from the new .squad/ directory. */
  app.post<{ Params: { id: string } }>('/workspaces/:id/activate', async (request, reply) => {
    const workspace = app.workspaceService.setActive(request.params.id);
    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace not found' });
    }

    // Re-initialize services with the new workspace's .squad/ directory
    try {
      const { resolve } = await import('node:path');
      const { existsSync, mkdirSync } = await import('node:fs');
      const newSquadDir = workspace.squadDir;

      // Ensure .squad/ exists
      if (!existsSync(newSquadDir)) {
        mkdirSync(newSquadDir, { recursive: true });
      }

      // Re-point the squad parser
      if (app.squadParser && typeof app.squadParser.setSquadDir === 'function') {
        app.squadParser.setSquadDir(newSquadDir);
      }

      // Re-sync team members from new workspace (clears old + re-inserts)
      const { syncTeamMembers } = await import('../services/db/seed-team.js');
      syncTeamMembers(app.db, newSquadDir);

      // Re-load agent registry from new DB
      if (app.agentRegistry) {
        app.agentRegistry.loadFromDatabase();
      }

      // Re-load skills from new workspace
      const { loadSkillsFromDirectory } = await import('../services/seed-skills.js');
      const skillsDirs = [
        resolve(newSquadDir, 'skills'),
        resolve(newSquadDir, 'templates', 'skills'),
        resolve(workspace.projectDir, '.copilot', 'skills'),
      ];
      for (const dir of skillsDirs) {
        if (existsSync(dir)) {
          loadSkillsFromDirectory(dir);
        }
      }

      // Scope traces to this workspace
      if (app.traceService && typeof app.traceService.setWorkspaceId === 'function') {
        app.traceService.setWorkspaceId(workspace.id);
      }

      // Scope chat messages to this workspace
      if (app.chatService && typeof app.chatService.setWorkspaceId === 'function') {
        app.chatService.setWorkspaceId(workspace.id);
      }

      // Refresh chat agent list from newly loaded registry
      if (app.chatService && app.agentRegistry && typeof app.chatService.setAgentRegistry === 'function') {
        app.chatService.setAgentRegistry(app.agentRegistry);
      }

      app.log.info(`Switched to workspace: ${workspace.name} (${newSquadDir})`);
    } catch (err) {
      app.log.warn(`Workspace switch partial: ${(err as Error).message}`);
    }

    return reply.send(workspace);
  });

  /** Check if a squad is initialized in this workspace. */
  app.get<{ Params: { id: string } }>('/workspaces/:id/status', async (request, reply) => {
    const workspace = app.workspaceService.get(request.params.id);
    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace not found' });
    }

    const { existsSync } = await import('node:fs');
    const { join } = await import('node:path');

    const squadDir = workspace.squadDir;
    const teamMdExists = existsSync(join(squadDir, 'team.md'));
    const agentsDir = join(squadDir, 'agents');
    let agentCount = 0;

    if (existsSync(agentsDir)) {
      const { readdirSync } = await import('node:fs');
      try {
        agentCount = readdirSync(agentsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
      } catch {
        // ignore
      }
    }

    return reply.send({
      initialized: existsSync(squadDir) && teamMdExists,
      hasTeam: teamMdExists,
      agentCount,
    });
  });

  /** Initialize a squad in a workspace — uses @bradygaster/squad-sdk initSquad(). */
  app.post<{ Params: { id: string }; Body: InitSquadBody }>(
    '/workspaces/:id/init',
    async (request, reply) => {
      const workspace = app.workspaceService.get(request.params.id);
      if (!workspace) {
        return reply.status(404).send({ error: 'Workspace not found' });
      }

      const { teamName, description, stack, agents } = request.body ?? {};
      if (!teamName || !agents || agents.length === 0) {
        return reply.status(400).send({ error: 'teamName and at least one agent are required' });
      }

      try {
        const { initSquad, defineSquad, defineTeam, defineAgent, useRole, searchRoles } = await import('@bradygaster/squad-sdk');
        const { join } = await import('node:path');

        // Map user roles to SDK base role IDs
        const roleMap: Record<string, string> = {
          'lead': 'lead', 'architect': 'lead', 'lead architect': 'lead', 'team lead': 'lead',
          'frontend': 'frontend', 'frontend dev': 'frontend', 'frontend developer': 'frontend', 'ui': 'frontend',
          'backend': 'backend', 'backend dev': 'backend', 'backend developer': 'backend',
          'full-stack': 'fullstack', 'full-stack dev': 'fullstack', 'fullstack': 'fullstack', 'developer': 'fullstack',
          'tester': 'tester', 'test': 'tester', 'qa': 'tester', 'test engineer': 'tester', 'quality': 'tester',
          'devops': 'devops', 'infrastructure': 'devops', 'sre': 'devops', 'build': 'devops', 'release': 'devops',
          'security': 'security', 'reviewer': 'reviewer', 'code reviewer': 'reviewer',
          'docs': 'docs', 'documentation': 'docs', 'technical writer': 'docs', 'writer': 'docs',
          'designer': 'designer', 'ui/ux': 'designer',
          'data': 'data', 'data engineer': 'data',
          'ai': 'ai', 'ml': 'ai', 'ai engineer': 'ai',
        };

        // Build AgentDefinitions using useRole (SDK catalog) or defineAgent (fallback)
        const agentDefs = agents.map((a) => {
          const slug = a.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const roleLower = a.role.toLowerCase();
          let roleId = roleMap[roleLower] ?? null;

          // Try searchRoles if no direct match
          if (!roleId) {
            const matches = searchRoles(a.role);
            if (matches.length > 0) roleId = matches[0]!.id;
          }

          let agentDef;
          if (roleId) {
            try {
              agentDef = useRole(roleId, { name: slug });
            } catch {
              // useRole failed, fall through to defineAgent
            }
          }

          if (!agentDef) {
            agentDef = defineAgent({
              name: slug,
              role: a.role,
              description: `${a.role} for the ${teamName} project.`,
            });
          }

          // Inject personality/backstory into charter
          if (a.personality || a.backstory) {
            const charSection = [
              '## Character\n',
              a.personality ? `**Personality:** ${a.personality}` : '',
              a.backstory ? `**Backstory:** ${a.backstory}` : '',
              '',
            ].filter(Boolean).join('\n');
            agentDef.charter = charSection + '\n' + (agentDef.charter ?? '');
          }

          return agentDef;
        });

        // Build typed config using SDK builders
        const squadConfig = defineSquad({
          team: defineTeam({
            name: teamName,
            description: description ?? undefined,
            members: agentDefs.map((a) => a.name),
            projectContext: `**Stack:** ${stack ?? 'N/A'}\n**Created:** ${new Date().toISOString().slice(0, 10)}`,
          }),
          agents: agentDefs,
        });

        // 1. Scaffold directory structure with initSquad
        const result = await initSquad({
          teamRoot: workspace.projectDir,
          projectName: teamName,
          projectDescription: description ?? undefined,
          agents: agents.map((a) => ({
            name: a.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            role: a.role.toLowerCase().replace(/\s+/g, '-'),
            displayName: `${a.name} — ${a.role}`,
          })),
          configFormat: 'typescript',
          skipExisting: true,
          includeWorkflows: false,
          includeTemplates: true,
          includeMcpConfig: false,
          roles: true,
          prompt: description ?? `${teamName} — ${stack ?? 'software project'}`,
        });

        app.log.info(`initSquad: ${result.createdFiles.length} created, ${result.skippedFiles.length} skipped`);

        // 2. Write squad.config.ts with proper agents using SDK config format
        const { writeFileSync, existsSync, mkdirSync } = await import('node:fs');
        const agentImports = agentDefs.map((a) => {
          const lines = [`  defineAgent({\n    name: '${a.name}',\n    role: '${a.role}',`];
          if (a.description) lines.push(`    description: ${JSON.stringify(a.description)},`);
          lines.push('  }),');
          return lines.join('\n');
        }).join('\n');

        const configContent = `import { defineSquad, defineTeam, defineAgent } from '@bradygaster/squad-sdk';

export default defineSquad({
  team: defineTeam({
    name: '${teamName}',
    description: ${JSON.stringify(description ?? '')},
    members: [${agentDefs.map((a) => `'${a.name}'`).join(', ')}],
    projectContext: '**Stack:** ${stack ?? 'N/A'}',
  }),
  agents: [
${agentImports}
  ],
});
`;
        writeFileSync(join(workspace.projectDir, 'squad.config.ts'), configContent, 'utf-8');

        // 3. Write team.md and charters using SDK data
        const descLine = description ? `\n> ${description}\n` : '';
        const memberRows = agentDefs
          .map((a) => `| ${agents.find((x) => x.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') === a.name)?.name ?? a.name} | ${a.role} | \`.squad/agents/${a.name}/charter.md\` | ✅ Active |`)
          .join('\n');
        writeFileSync(
          join(result.squadDir, 'team.md'),
          `# ${teamName}\n${descLine}\n## Members\n\n| Name | Role | Charter | Status |\n|------|------|---------|--------|\n${memberRows}\n\n## Project Context\n\n- **Project:** ${teamName}\n- **Stack:** ${stack ?? 'N/A'}\n- **Created:** ${new Date().toISOString().slice(0, 10)}\n`,
          'utf-8',
        );

        // Write rich charters from useRole agent definitions
        for (const agentDef of agentDefs) {
          const agentDir = join(result.squadDir, 'agents', agentDef.name);
          if (!existsSync(agentDir)) mkdirSync(agentDir, { recursive: true });

          const original = agents.find((x) => x.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') === agentDef.name);
          const displayName = original?.name ?? agentDef.name;

          // Build charter from agent definition (useRole provides full charter content)
          const lines: string[] = [];
          lines.push(`# ${displayName} — ${agentDef.role}\n`);
          if (agentDef.description) lines.push(`> ${agentDef.description}\n`);
          if (agentDef.charter) {
            lines.push(agentDef.charter);
            lines.push('');
          }

          writeFileSync(join(agentDir, 'charter.md'), lines.join('\n'), 'utf-8');
        }

        app.log.info('Wrote squad.config.ts, team.md, and agent charters via SDK');

        // 4. Re-sync DB
        const { syncTeamMembers } = await import('../services/db/seed-team.js');
        syncTeamMembers(app.db, result.squadDir);

        if (app.agentRegistry) app.agentRegistry.loadFromDatabase();
        if (app.squadParser && typeof app.squadParser.setSquadDir === 'function') {
          app.squadParser.setSquadDir(result.squadDir);
        }
        if (app.traceService && typeof app.traceService.setWorkspaceId === 'function') {
          app.traceService.setWorkspaceId(workspace.id);
        }
        if (app.chatService && typeof (app.chatService as Record<string, unknown>).setWorkspaceId === 'function') {
          (app.chatService as Record<string, (id: string) => void>).setWorkspaceId(workspace.id);
        }

        const updatedWorkspace = app.workspaceService.update(workspace.id, {});
        return reply.status(201).send({
          workspace: updatedWorkspace ?? workspace,
          created: result.createdFiles,
          skipped: result.skippedFiles,
          squadDir: result.squadDir,
        });
      } catch (err) {
        app.log.error(`Squad init failed: ${(err as Error).message}`);
        return reply.status(500).send({ error: `Initialization failed: ${(err as Error).message}` });
      }
    },
  );

  /** Analyze a workspace project to auto-detect team composition via LLM, optionally themed via CastingEngine. */
  app.post<{ Params: { id: string }; Body: { universe?: string; theme?: string; teamName?: string; description?: string; stack?: string } }>('/workspaces/:id/analyze', async (request, reply) => {
    const workspace = app.workspaceService.get(request.params.id);
    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace not found' });
    }

    const aiProvider = app.voiceServices?.aiProvider;
    if (!aiProvider) {
      return reply.status(503).send({ error: 'AI provider is not available' });
    }

    const { existsSync, readFileSync, readdirSync } = await import('node:fs');
    const { join } = await import('node:path');

    const projectDir = workspace.projectDir;
    const snippets: string[] = [];

    // Detect package manifests
    const manifests = [
      'package.json',
      'requirements.txt',
      'pyproject.toml',
      'go.mod',
      'Cargo.toml',
      'pom.xml',
      'build.gradle',
      'Gemfile',
      'composer.json',
    ];
    for (const name of manifests) {
      const filePath = join(projectDir, name);
      if (existsSync(filePath)) {
        try {
          const content = readFileSync(filePath, 'utf-8').slice(0, 2000);
          snippets.push(`--- ${name} ---\n${content}`);
        } catch { /* ignore */ }
      }
    }

    // List top-level directories
    try {
      const entries = readdirSync(projectDir, { withFileTypes: true });
      const dirs = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
        .map((e) => e.name);
      const files = entries.filter((e) => e.isFile()).map((e) => e.name);
      snippets.push(`--- Top-level directories ---\n${dirs.join(', ')}`);
      snippets.push(`--- Top-level files ---\n${files.join(', ')}`);
    } catch { /* ignore */ }

    // Read README
    for (const readmeName of ['README.md', 'readme.md', 'README.rst', 'README.txt']) {
      const readmePath = join(projectDir, readmeName);
      if (existsSync(readmePath)) {
        try {
          snippets.push(`--- ${readmeName} ---\n${readFileSync(readmePath, 'utf-8').slice(0, 2000)}`);
        } catch { /* ignore */ }
        break;
      }
    }

    // Check for common patterns
    const patterns = [
      '.github', 'docker-compose.yml', 'Dockerfile',
      'terraform', '.terraform', 'k8s', 'kubernetes',
      'tsconfig.json', '.eslintrc.json', 'eslint.config.mjs',
      'jest.config.ts', 'vitest.config.ts', 'playwright.config.ts',
      'turbo.json', 'pnpm-workspace.yaml', 'lerna.json', 'nx.json',
    ];
    const found = patterns.filter((p) => existsSync(join(projectDir, p)));
    if (found.length > 0) {
      snippets.push(`--- Detected patterns ---\n${found.join(', ')}`);
    }

    const projectContext = snippets.join('\n\n');
    const { theme: themeText, teamName: inputName, description: inputDesc, stack: inputStack } = request.body ?? {};

    // Build user-provided context block
    const userContext: string[] = [];
    if (inputName) userContext.push(`Team name: "${inputName}"`);
    if (inputDesc) userContext.push(`Project description: "${inputDesc}"`);
    if (inputStack) userContext.push(`Tech stack: ${inputStack}`);
    const userContextBlock = userContext.length > 0
      ? `\n\nThe user has provided the following context about their project:\n${userContext.join('\n')}\nUse this information to tailor your suggestions.`
      : '';

    const themeInstruction = themeText
      ? `\n\nCRITICAL REQUIREMENT — TEAM THEME: "${themeText}"\nYou MUST name every agent after a character from "${themeText}". Do NOT use generic names like "Frontend Agent" or "Dev Agent". Use actual character names from the theme. Give each agent a personality and backstory inspired by their character. Include "personality" and "backstory" fields in the JSON.`
      : '';
    const systemPrompt =
      'You are a software project analyzer that creates themed AI agent teams. Respond ONLY with valid JSON, no markdown fences, no explanation.';
    const userPrompt = `${themeText ? `THEME: "${themeText}" — all agent names MUST be characters from this theme.\n\n` : ''}Analyze this project and suggest an AI agent team composition.\n\n${projectContext}${userContextBlock}\n\nRespond with JSON in this exact shape:\n{\n  "teamName": "short team name",\n  "description": "1-2 sentence project description",\n  "stack": "comma-separated tech stack",\n  "agents": [\n    { "name": "Character Name", "role": "Role Title", "personality": "one-line trait", "backstory": "short backstory" }\n  ]\n}\n\nSuggest 3-6 agents tailored to this specific project. Each agent should have a clear, distinct role relevant to the project's tech stack and structure.${themeInstruction}`;

    try {
      const result = await aiProvider.chatCompletion({
        messages: [{ role: 'user', content: userPrompt }],
        systemPrompt,
        taskTitle: 'workspace-analyze',
        agentId: 'system',
      });

      // Parse the JSON from the LLM response
      let raw = result.content.trim();
      // Strip markdown fences if present
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) raw = fenceMatch[1]!.trim();

      try {
        var parsed = JSON.parse(raw) as {
          teamName?: string;
          description?: string;
          stack?: string;
          agents?: Array<{ name: string; role: string; personality?: string; backstory?: string }>;
        };
      } catch {
        // LLM returned non-JSON (e.g. mock provider) — fall through to heuristic
        parsed = undefined as unknown as typeof parsed;
      }

      if (parsed?.agents?.length) {
        let finalAgents = parsed.agents.filter((a) => a.name && a.role).slice(0, 8);

        // If a universe was requested, cast themed personas for the detected roles
        const universe = (request.body as { universe?: string })?.universe;
        if (universe && finalAgents.length > 0) {
          try {
            const { CastingEngine } = await import('@bradygaster/squad-sdk');
            const engine = new CastingEngine();
            const roleMap: Record<string, string> = {
              'lead': 'lead', 'team lead': 'lead', 'project lead': 'lead',
              'developer': 'developer', 'dev': 'developer', 'engineer': 'developer',
              'frontend': 'developer', 'backend': 'developer', 'full-stack': 'developer',
              'tester': 'tester', 'qa': 'tester', 'testing': 'tester',
              'devops': 'devops', 'infrastructure': 'devops', 'ops': 'devops', 'sre': 'devops',
              'security': 'security', 'designer': 'designer', 'ui/ux': 'designer',
              'scribe': 'scribe', 'writer': 'scribe', 'docs': 'scribe',
              'reviewer': 'reviewer', 'code review': 'reviewer',
            };
            const requiredRoles = finalAgents.map((a) => {
              const lower = a.role.toLowerCase();
              return (roleMap[lower] ?? 'developer') as 'lead' | 'developer' | 'tester';
            });
            const cast = engine.castTeam({
              universe: universe as 'usual-suspects' | 'oceans-eleven' | 'custom',
              teamSize: finalAgents.length,
              requiredRoles: [...new Set(requiredRoles)] as Array<
                'lead' | 'developer' | 'tester' | 'prompt-engineer' | 'security' | 'devops' | 'designer' | 'scribe' | 'reviewer'
              >,
            });
            finalAgents = finalAgents.map((a, i) => {
              const castMember = cast[i];
              return castMember
                ? { name: castMember.name, role: a.role, personality: castMember.personality, backstory: castMember.backstory }
                : a;
            });
          } catch (castErr) {
            app.log.warn(`CastingEngine failed, using LLM names: ${(castErr as Error).message}`);
          }
        }

        return reply.send({
          teamName: parsed.teamName ?? workspace.name,
          description: parsed.description ?? '',
          stack: parsed.stack ?? '',
          agents: finalAgents,
        });
      }
    } catch (err) {
      app.log.warn(`LLM analyze failed, using heuristic: ${(err as Error).message}`);
    }

    // ── Heuristic fallback (mock provider or LLM parse failure) ──
    const detectedStack: string[] = [];
    const detectedRoles: Array<{ name: string; role: string }> = [
      { name: 'Lead Agent', role: 'Lead' },
    ];

    for (const s of snippets) {
      if (s.includes('package.json')) { detectedStack.push('Node.js'); if (s.includes('react')) detectedStack.push('React'); if (s.includes('next')) detectedStack.push('Next.js'); if (s.includes('typescript')) detectedStack.push('TypeScript'); }
      if (s.includes('requirements.txt') || s.includes('pyproject.toml')) detectedStack.push('Python');
      if (s.includes('go.mod')) detectedStack.push('Go');
      if (s.includes('Cargo.toml')) detectedStack.push('Rust');
      if (s.includes('pom.xml') || s.includes('build.gradle')) detectedStack.push('Java');
      if (s.includes('Dockerfile') || s.includes('docker-compose')) { detectedStack.push('Docker'); detectedRoles.push({ name: 'DevOps Agent', role: 'DevOps' }); }
      if (s.includes('terraform') || s.includes('k8s')) detectedRoles.push({ name: 'Infra Agent', role: 'Infrastructure' });
      if (s.includes('vitest') || s.includes('jest') || s.includes('playwright')) detectedRoles.push({ name: 'Test Agent', role: 'Tester' });
    }
    detectedRoles.push({ name: 'Dev Agent', role: 'Developer' });

    // Deduplicate
    const uniqueStack = [...new Set(detectedStack)];
    const seenRoles = new Set<string>();
    const uniqueRoles = detectedRoles.filter((r) => { if (seenRoles.has(r.role)) return false; seenRoles.add(r.role); return true; });

    // Apply CastingEngine if universe requested
    const universe = (request.body as { universe?: string })?.universe;
    let finalAgents: Array<{ name: string; role: string; personality?: string; backstory?: string }> = uniqueRoles;
    if (universe) {
      try {
        const { CastingEngine } = await import('@bradygaster/squad-sdk');
        const engine = new CastingEngine();
        const cast = engine.castTeam({
          universe: universe as 'usual-suspects' | 'oceans-eleven' | 'custom',
          teamSize: uniqueRoles.length,
          requiredRoles: ['lead', 'developer'],
        });
        finalAgents = uniqueRoles.map((a, i) => {
          const c = cast[i];
          return c ? { name: c.name, role: a.role, personality: c.personality, backstory: c.backstory } : a;
        });
      } catch { /* use generic names */ }
    }

    return reply.send({
      teamName: workspace.name,
      description: `Project at ${workspace.projectDir}`,
      stack: uniqueStack.join(', '),
      agents: finalAgents,
    });
  });

  /** List available CastingEngine universes. */
  app.get('/workspaces/universes', async (_request, reply) => {
    try {
      const { CastingEngine } = await import('@bradygaster/squad-sdk');
      const engine = new CastingEngine();
      const universes = engine.getUniverses().map((uid) => {
        const u = engine.getUniverse(uid)!;
        return {
          id: uid,
          label: u.label,
          characters: u.characters.map((c) => ({
            name: c.name,
            personality: c.personality,
            preferredRoles: c.preferredRoles,
          })),
        };
      });
      return reply.send(universes);
    } catch (err) {
      app.log.error(`Failed to load universes: ${(err as Error).message}`);
      return reply.send([]);
    }
  });

  /** Cast a themed team using CastingEngine. */
  app.post<{ Body: { universe: string; teamSize?: number; requiredRoles?: string[] } }>(
    '/workspaces/cast',
    async (request, reply) => {
      const { universe, teamSize, requiredRoles } = request.body ?? {};
      if (!universe) {
        return reply.status(400).send({ error: 'universe is required' });
      }

      try {
        const { CastingEngine } = await import('@bradygaster/squad-sdk');
        const engine = new CastingEngine();

        const cast = engine.castTeam({
          universe: universe as 'usual-suspects' | 'oceans-eleven' | 'custom',
          teamSize: teamSize ?? 4,
          requiredRoles: (requiredRoles ?? ['lead', 'developer', 'tester']) as Array<
            'lead' | 'developer' | 'tester' | 'prompt-engineer' | 'security' | 'devops' | 'designer' | 'scribe' | 'reviewer'
          >,
        });

        return reply.send(
          cast.map((c) => ({
            name: c.name,
            role: c.role,
            personality: c.personality,
            backstory: c.backstory,
            displayName: c.displayName,
          })),
        );
      } catch (err) {
        app.log.error(`Cast failed: ${(err as Error).message}`);
        return reply.status(500).send({ error: `Casting failed: ${(err as Error).message}` });
      }
    },
  );

  /** Delete the .squad directory from a workspace. */
  app.delete<{ Params: { id: string } }>('/workspaces/:id/squad', async (request, reply) => {
    const workspace = app.workspaceService.get(request.params.id);
    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace not found' });
    }

    const { existsSync } = await import('node:fs');
    const { rm } = await import('node:fs/promises');
    const { join } = await import('node:path');

    const squadDir = workspace.squadDir;
    if (!existsSync(squadDir)) {
      return reply.status(404).send({ error: 'No .squad directory found' });
    }

    try {
      await rm(squadDir, { recursive: true, force: true });

      // Also remove squad.config.ts if it exists
      const configPath = join(workspace.projectDir, 'squad.config.ts');
      if (existsSync(configPath)) await rm(configPath, { force: true });

      // Clear team members from DB
      app.db.prepare('DELETE FROM team_members').run();
      if (app.agentRegistry) app.agentRegistry.loadFromDatabase();

      app.log.info(`Deleted .squad from workspace: ${workspace.name}`);
      return reply.send({ success: true });
    } catch (err) {
      app.log.error(`Failed to delete .squad: ${(err as Error).message}`);
      return reply.status(500).send({ error: `Failed to delete: ${(err as Error).message}` });
    }
  });

  // GET /api/workspaces/browse — list directories for workspace picker
  app.get<{ Querystring: { path?: string } }>('/workspaces/browse', async (request, reply) => {
    const { readdirSync, statSync } = await import('node:fs');
    const { resolve, join, basename } = await import('node:path');
    const { homedir } = await import('node:os');

    const basePath = request.query.path?.trim() || homedir();
    const resolved = resolve(basePath);

    try {
      const entries = readdirSync(resolved, { withFileTypes: true });
      const dirs = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => {
          const fullPath = join(resolved, e.name);
          const hasSquad = (() => { try { statSync(join(fullPath, '.squad')); return true; } catch { return false; } })();
          const hasGit = (() => { try { statSync(join(fullPath, '.git')); return true; } catch { return false; } })();
          return { name: e.name, path: fullPath, hasSquad, hasGit };
        })
        .sort((a, b) => {
          if (a.hasSquad !== b.hasSquad) return a.hasSquad ? -1 : 1;
          if (a.hasGit !== b.hasGit) return a.hasGit ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      return reply.send({
        current: resolved,
        parent: resolve(resolved, '..'),
        name: basename(resolved),
        dirs,
      });
    } catch {
      return reply.status(400).send({ error: `Cannot read directory: ${resolved}` });
    }
  });
};

export default workspacesRoute;

declare module 'fastify' {
  interface FastifyInstance {
    workspaceService: WorkspaceService;
    chatService: ChatService;
    agentRegistry: AgentRegistry;
    db: import('better-sqlite3').Database;
    squadParser: { setSquadDir?: (dir: string) => void };
    voiceServices: VoiceServices;
  }
}
