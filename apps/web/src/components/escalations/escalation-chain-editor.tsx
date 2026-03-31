'use client';

import type { EscalationChain } from '@matanelcohen/openspace-shared';
import { ChevronDown, ChevronRight, Link2, Plus, Save, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type EscalationChainLevel = EscalationChain['levels'][number];

interface EscalationChainEditorProps {
  chains: EscalationChain[];
  onSave: (chains: EscalationChain[]) => void;
  isSaving?: boolean;
}

let chainKeyCounter = 0;
function nextChainKey() {
  return `chain-${++chainKeyCounter}`;
}

function formatTimeout(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

function parseTimeoutMinutes(value: string): number {
  const num = parseInt(value, 10);
  return isNaN(num) || num < 1 ? 1 : num;
}

function validateChain(chain: EscalationChain): string | null {
  if (!chain.name.trim()) return 'Chain name is required';
  if (chain.levels.length === 0) return 'At least one level is required';
  for (const level of chain.levels) {
    if (!level.name.trim()) return `Level ${level.level}: name is required`;
    if (level.timeoutMs < 60_000) return `Level ${level.level}: timeout must be at least 1 minute`;
  }
  return null;
}

export function EscalationChainEditor({
  chains,
  onSave,
  isSaving = false,
}: EscalationChainEditorProps) {
  const [items, setItems] = useState<(EscalationChain & { _key: string })[]>(() =>
    chains.map((c) => ({ ...c, _key: nextChainKey() })),
  );
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setItems(chains.map((c) => ({ ...c, _key: nextChainKey() })));
    setIsDirty(false);
    setExpandedKeys(new Set());
  }, [chains]);

  const toggleExpanded = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const updateChain = useCallback((key: string, updates: Partial<EscalationChain>) => {
    setItems((prev) => prev.map((c) => (c._key === key ? { ...c, ...updates } : c)));
    setIsDirty(true);
  }, []);

  const addChain = useCallback(() => {
    const key = nextChainKey();
    setItems((prev) => [
      ...prev,
      {
        id: `chain-${Date.now()}`,
        name: '',
        levels: [{ level: 1, name: 'L1 Reviewer', reviewerIds: [], timeoutMs: 30 * 60_000 }],
        _key: key,
      },
    ]);
    setExpandedKeys((prev) => new Set([...prev, key]));
    setIsDirty(true);
  }, []);

  const removeChain = useCallback((key: string) => {
    setItems((prev) => prev.filter((c) => c._key !== key));
    setIsDirty(true);
  }, []);

  const updateLevel = useCallback(
    (chainKey: string, levelIndex: number, updates: Partial<EscalationChainLevel>) => {
      setItems((prev) =>
        prev.map((c) => {
          if (c._key !== chainKey) return c;
          const levels = c.levels.map((l, i) => (i === levelIndex ? { ...l, ...updates } : l));
          return { ...c, levels };
        }),
      );
      setIsDirty(true);
    },
    [],
  );

  const addLevel = useCallback((chainKey: string) => {
    setItems((prev) =>
      prev.map((c) => {
        if (c._key !== chainKey) return c;
        const nextLevel = c.levels.length + 1;
        return {
          ...c,
          levels: [
            ...c.levels,
            {
              level: nextLevel,
              name: `L${nextLevel} Reviewer`,
              reviewerIds: [],
              timeoutMs: 30 * 60_000,
            },
          ],
        };
      }),
    );
    setIsDirty(true);
  }, []);

  const removeLevel = useCallback((chainKey: string, levelIndex: number) => {
    setItems((prev) =>
      prev.map((c) => {
        if (c._key !== chainKey) return c;
        const levels = c.levels
          .filter((_, i) => i !== levelIndex)
          .map((l, i) => ({ ...l, level: i + 1 }));
        return { ...c, levels };
      }),
    );
    setIsDirty(true);
  }, []);

  const handleReviewerIdsChange = useCallback(
    (chainKey: string, levelIndex: number, value: string) => {
      const ids = value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      updateLevel(chainKey, levelIndex, { reviewerIds: ids });
    },
    [updateLevel],
  );

  const errors = items.map((c) => validateChain(c));
  const hasErrors = errors.some((e) => e !== null);

  const handleSave = () => {
    if (hasErrors) return;
    const cleaned: EscalationChain[] = items.map(({ _key, ...rest }) => rest);
    onSave(cleaned);
    setIsDirty(false);
  };

  const handleReset = () => {
    setItems(chains.map((c) => ({ ...c, _key: nextChainKey() })));
    setIsDirty(false);
    setExpandedKeys(new Set());
  };

  return (
    <Card data-testid="escalation-chain-editor">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" />
          Escalation Chains
        </CardTitle>
        <div className="flex items-center gap-2">
          {isDirty && (
            <Button variant="ghost" size="sm" onClick={handleReset} data-testid="reset-chains-btn">
              <X className="mr-1 h-3 w-3" />
              Reset
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || hasErrors || isSaving}
            data-testid="save-chains-btn"
          >
            <Save className="mr-1 h-3 w-3" />
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Escalation chains define the review path. Each level has a timeout before auto-escalating
          to the next level.
        </p>

        {items.length === 0 ? (
          <div
            className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"
            data-testid="no-chains"
          >
            No escalation chains configured. Add one to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((chain, chainIndex) => {
              const isExpanded = expandedKeys.has(chain._key);
              const error = errors[chainIndex];

              return (
                <div
                  key={chain._key}
                  className="rounded-md border"
                  data-testid={`chain-${chainIndex}`}
                >
                  {/* Chain header */}
                  <div className="flex items-center gap-2 p-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => toggleExpanded(chain._key)}
                      aria-label={isExpanded ? 'Collapse chain' : 'Expand chain'}
                      data-testid={`toggle-chain-${chainIndex}`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <Input
                      placeholder="Chain name…"
                      value={chain.name}
                      onChange={(e) => updateChain(chain._key, { name: e.target.value })}
                      className="max-w-xs"
                      data-testid={`chain-name-${chainIndex}`}
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {chain.levels.length} level{chain.levels.length !== 1 ? 's' : ''}
                    </span>
                    {error && <span className="text-xs text-destructive truncate">{error}</span>}
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeChain(chain._key)}
                      aria-label={`Remove chain ${chain.name || chainIndex + 1}`}
                      data-testid={`remove-chain-${chainIndex}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Expanded levels */}
                  {isExpanded && (
                    <div
                      className="border-t px-3 pb-3 pt-2 space-y-3"
                      data-testid={`chain-levels-${chainIndex}`}
                    >
                      {/* Level column headers */}
                      <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-3 px-1 text-xs font-medium text-muted-foreground">
                        <span className="w-8">Level</span>
                        <span>Name</span>
                        <span>Reviewer IDs (comma-separated)</span>
                        <span>Timeout (minutes)</span>
                        <span className="w-8" />
                      </div>

                      {chain.levels.map((level, levelIndex) => (
                        <div
                          key={levelIndex}
                          className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-3 items-center"
                          data-testid={`level-${chainIndex}-${levelIndex}`}
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">
                            {level.level}
                          </span>
                          <Input
                            placeholder="Level name…"
                            value={level.name}
                            onChange={(e) =>
                              updateLevel(chain._key, levelIndex, { name: e.target.value })
                            }
                            data-testid={`level-name-${chainIndex}-${levelIndex}`}
                          />
                          <Input
                            placeholder="reviewer-1, reviewer-2"
                            value={level.reviewerIds.join(', ')}
                            onChange={(e) =>
                              handleReviewerIdsChange(chain._key, levelIndex, e.target.value)
                            }
                            data-testid={`level-reviewers-${chainIndex}-${levelIndex}`}
                          />
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              value={Math.round(level.timeoutMs / 60_000)}
                              onChange={(e) =>
                                updateLevel(chain._key, levelIndex, {
                                  timeoutMs: parseTimeoutMinutes(e.target.value) * 60_000,
                                })
                              }
                              className="tabular-nums"
                              data-testid={`level-timeout-${chainIndex}-${levelIndex}`}
                            />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              ({formatTimeout(level.timeoutMs)})
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeLevel(chain._key, levelIndex)}
                            aria-label={`Remove level ${level.level}`}
                            disabled={chain.levels.length <= 1}
                            data-testid={`remove-level-${chainIndex}-${levelIndex}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addLevel(chain._key)}
                        data-testid={`add-level-${chainIndex}`}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Add Level
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Button variant="outline" size="sm" onClick={addChain} data-testid="add-chain-btn">
          <Plus className="mr-1 h-3 w-3" />
          Add Chain
        </Button>
      </CardContent>
    </Card>
  );
}
