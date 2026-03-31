'use client';

import type { ConfidenceThreshold } from '@matanelcohen/openspace-shared';
import { AlertTriangle, Plus, Save, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ThresholdConfigPanelProps {
  thresholds: ConfidenceThreshold[];
  onSave: (thresholds: ConfidenceThreshold[]) => void;
  isSaving?: boolean;
}

interface ThresholdRow extends ConfidenceThreshold {
  _key: string;
}

let keyCounter = 0;
function nextKey() {
  return `threshold-${++keyCounter}`;
}

function validateThreshold(t: ConfidenceThreshold): string | null {
  if (t.threshold < 0 || t.threshold > 1) return 'Threshold must be between 0 and 1';
  if (!Number.isInteger(t.escalationLevel) || t.escalationLevel < 1)
    return 'Escalation level must be a positive integer';
  return null;
}

function getThresholdColor(value: number): string {
  if (value >= 0.8) return 'border-green-300 dark:border-green-700';
  if (value >= 0.5) return 'border-yellow-300 dark:border-yellow-700';
  return 'border-red-300 dark:border-red-700';
}

export function ThresholdConfigPanel({
  thresholds,
  onSave,
  isSaving = false,
}: ThresholdConfigPanelProps) {
  const [rows, setRows] = useState<ThresholdRow[]>(() =>
    thresholds.map((t) => ({ ...t, _key: nextKey() })),
  );
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setRows(thresholds.map((t) => ({ ...t, _key: nextKey() })));
    setIsDirty(false);
  }, [thresholds]);

  const updateRow = useCallback((key: string, updates: Partial<ConfidenceThreshold>) => {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...updates } : r)));
    setIsDirty(true);
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => [
      ...prev,
      { threshold: 0.5, escalationLevel: 1, agentRoles: [], _key: nextKey() },
    ]);
    setIsDirty(true);
  }, []);

  const removeRow = useCallback((key: string) => {
    setRows((prev) => prev.filter((r) => r._key !== key));
    setIsDirty(true);
  }, []);

  const handleRolesChange = useCallback((key: string, value: string) => {
    const roles = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setRows((prev) =>
      prev.map((r) =>
        r._key === key ? { ...r, agentRoles: roles.length > 0 ? roles : undefined } : r,
      ),
    );
    setIsDirty(true);
  }, []);

  const errors = rows.map((r) => validateThreshold(r));
  const hasErrors = errors.some((e) => e !== null);

  const handleSave = () => {
    if (hasErrors) return;
    const cleaned: ConfidenceThreshold[] = rows.map(({ _key, ...rest }) => rest);
    onSave(cleaned);
    setIsDirty(false);
  };

  const handleReset = () => {
    setRows(thresholds.map((t) => ({ ...t, _key: nextKey() })));
    setIsDirty(false);
  };

  return (
    <Card data-testid="threshold-config-panel">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4" />
          Confidence Thresholds
        </CardTitle>
        <div className="flex items-center gap-2">
          {isDirty && (
            <Button variant="ghost" size="sm" onClick={handleReset} data-testid="reset-btn">
              <X className="mr-1 h-3 w-3" />
              Reset
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || hasErrors || isSaving}
            data-testid="save-thresholds-btn"
          >
            <Save className="mr-1 h-3 w-3" />
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Configure the confidence score thresholds that trigger escalations. When an agent&apos;s
          confidence drops below a threshold, the escalation is routed to the specified chain level.
        </p>

        {rows.length === 0 ? (
          <div
            className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"
            data-testid="no-thresholds"
          >
            No thresholds configured. Add one to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_1fr_2fr_auto] gap-3 px-1 text-xs font-medium text-muted-foreground">
              <span>Threshold (0–1)</span>
              <span>Escalation Level</span>
              <span>Agent Roles (comma-separated)</span>
              <span className="w-8" />
            </div>

            {rows.map((row, index) => (
              <div
                key={row._key}
                className={cn(
                  'grid grid-cols-[1fr_1fr_2fr_auto] gap-3 items-start rounded-md border p-3',
                  getThresholdColor(row.threshold),
                )}
                data-testid={`threshold-row-${index}`}
              >
                <div>
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={row.threshold}
                    onChange={(e) =>
                      updateRow(row._key, { threshold: parseFloat(e.target.value) || 0 })
                    }
                    className="tabular-nums"
                    data-testid={`threshold-value-${index}`}
                  />
                  {errors[index] && errors[index]!.includes('Threshold') && (
                    <p className="mt-1 text-xs text-destructive">{errors[index]}</p>
                  )}
                </div>
                <div>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={row.escalationLevel}
                    onChange={(e) =>
                      updateRow(row._key, {
                        escalationLevel: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="tabular-nums"
                    data-testid={`threshold-level-${index}`}
                  />
                  {errors[index] && errors[index]!.includes('level') && (
                    <p className="mt-1 text-xs text-destructive">{errors[index]}</p>
                  )}
                </div>
                <Input
                  placeholder="e.g. frontend, backend, devops"
                  value={(row.agentRoles ?? []).join(', ')}
                  onChange={(e) => handleRolesChange(row._key, e.target.value)}
                  data-testid={`threshold-roles-${index}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  onClick={() => removeRow(row._key)}
                  aria-label={`Remove threshold ${index + 1}`}
                  data-testid={`remove-threshold-${index}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button variant="outline" size="sm" onClick={addRow} data-testid="add-threshold-btn">
          <Plus className="mr-1 h-3 w-3" />
          Add Threshold
        </Button>
      </CardContent>
    </Card>
  );
}
