'use client';

import '@xyflow/react/dist/style.css';

import {
  Background,
  BackgroundVariant,
  type Edge,
  MarkerType,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { useEffect, useMemo } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSkillDetail, useSkills } from '@/hooks/use-skills';

interface SkillDependencyGraphProps {
  skillIds: string[];
}

export function SkillDependencyGraph({ skillIds }: SkillDependencyGraphProps) {
  return (
    <ReactFlowProvider>
      <SkillDependencyGraphInner skillIds={skillIds} />
    </ReactFlowProvider>
  );
}

function SkillDependencyGraphInner({ skillIds }: SkillDependencyGraphProps) {
  const { data: allSkills } = useSkills();

  // Fetch details for each skill to get dependency info
  const detailQueries = skillIds.map((id) => ({
    id,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    query: useSkillDetail(id),
  }));

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!allSkills) return { nodes: [], edges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const skillSet = new Set(skillIds);
    const externalIds = new Set<string>();

    // Collect external dependency IDs first
    for (const { query } of detailQueries) {
      const deps = query.data?.manifest.dependencies ?? [];
      for (const dep of deps) {
        if (!skillSet.has(dep.skillId)) {
          externalIds.add(dep.skillId);
        }
      }
    }

    // Position assigned skills in a grid
    const cols = Math.max(3, Math.ceil(Math.sqrt(skillIds.length + externalIds.size)));

    skillIds.forEach((skillId, index) => {
      const meta = allSkills.find((s) => s.id === skillId);
      const col = index % cols;
      const row = Math.floor(index / cols);

      nodes.push({
        id: skillId,
        position: { x: col * 220, y: row * 120 },
        data: { label: meta?.name ?? skillId },
        style: {
          background: 'hsl(var(--primary) / 0.1)',
          border: '2px solid hsl(var(--primary) / 0.5)',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '12px',
          fontWeight: 500,
          color: 'hsl(var(--card-foreground))',
          minWidth: '140px',
          textAlign: 'center' as const,
        },
      });
    });

    // Position external dependencies below
    const externalArr = Array.from(externalIds);
    const startRow = Math.ceil(skillIds.length / cols) + 1;
    externalArr.forEach((extId, index) => {
      const meta = allSkills.find((s) => s.id === extId);
      const col = index % cols;
      const row = startRow + Math.floor(index / cols);

      nodes.push({
        id: extId,
        position: { x: col * 220, y: row * 120 },
        data: { label: meta?.name ?? extId },
        style: {
          background: 'hsl(var(--muted))',
          border: '1px dashed hsl(var(--border))',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '11px',
          fontWeight: 400,
          fontStyle: 'italic',
          color: 'hsl(var(--muted-foreground))',
          minWidth: '140px',
          textAlign: 'center' as const,
        },
      });
    });

    // Build edges from dependency data
    for (const { id: sourceId, query } of detailQueries) {
      const deps = query.data?.manifest.dependencies ?? [];
      const resolved = query.data?.manifest.resolvedDependencies ?? {};

      for (const dep of deps) {
        const isResolved = !!resolved[dep.skillId];
        edges.push({
          id: `${sourceId}->${dep.skillId}`,
          source: sourceId,
          target: dep.skillId,
          animated: !isResolved,
          style: {
            stroke: dep.optional
              ? 'hsl(var(--muted-foreground) / 0.4)'
              : isResolved
                ? 'hsl(142 76% 36% / 0.6)'
                : 'hsl(38 92% 50% / 0.7)',
            strokeDasharray: dep.optional ? '5 5' : undefined,
            strokeWidth: dep.optional ? 1 : 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
          },
          label: dep.versionRange ?? undefined,
          labelStyle: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' },
        });
      }
    }

    return { nodes, edges };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSkills, skillIds, ...detailQueries.map((q) => q.query.data)]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  return (
    <Card data-testid="skill-dependency-graph">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Skill Dependency Graph</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full rounded-md border bg-background/50">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable={false}
            minZoom={0.5}
            maxZoom={1.5}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          </ReactFlow>
        </div>
        <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-6 rounded-sm bg-green-500/60" />
            Resolved dep
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-6 rounded-sm bg-amber-500/60" />
            Unresolved dep
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-6 border-t border-dashed border-muted-foreground/60" />
            Optional
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-4 rounded-sm border-2 border-primary/50 bg-primary/10" />
            Assigned
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-4 rounded-sm border border-dashed border-muted-foreground/40 bg-muted" />
            External
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
