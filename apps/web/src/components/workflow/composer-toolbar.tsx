'use client';

import type { WorkflowDefinition } from '@matanelcohen/openspace-shared';
import { validateWorkflow } from '@matanelcohen/openspace-shared';
import { AlertCircle, CheckCircle2, Download, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ── Props ────────────────────────────────────────────────────────

interface ComposerToolbarProps {
  workflowName: string;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onClear: () => void;
  onExport: () => void;
  getDefinition: () => WorkflowDefinition;
  className?: string;
}

/**
 * Toolbar for the workflow composer with save, validate, clear, and export actions.
 */
export function ComposerToolbar({
  workflowName,
  onNameChange,
  onSave,
  onClear,
  onExport,
  getDefinition,
  className,
}: ComposerToolbarProps) {
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validated, setValidated] = useState(false);

  const handleValidate = useCallback(() => {
    const def = getDefinition();
    const errors = validateWorkflow(def);
    setValidationErrors(errors);
    setValidated(true);
    setTimeout(() => setValidated(false), 5000);
  }, [getDefinition]);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3',
        className,
      )}
      data-testid="composer-toolbar"
    >
      {/* Workflow name input */}
      <input
        type="text"
        value={workflowName}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Workflow name…"
        className="min-w-[200px] flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        data-testid="workflow-name-input"
      />

      {/* Action buttons */}
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={handleValidate} data-testid="validate-btn">
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
          Validate
        </Button>
        <Button variant="outline" size="sm" onClick={onExport} data-testid="export-btn">
          <Download className="mr-1 h-3.5 w-3.5" />
          Export
        </Button>
        <Button variant="default" size="sm" onClick={onSave} data-testid="save-btn">
          <Save className="mr-1 h-3.5 w-3.5" />
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} data-testid="clear-btn">
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Clear
        </Button>
      </div>

      {/* Validation feedback */}
      {validated && (
        <div className="w-full">
          {validationErrors.length === 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Workflow is valid
            </div>
          ) : (
            <div className="space-y-1">
              {validationErrors.map((err, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-red-500">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {err}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Undo button component (can be placed separately).
 */
export function UndoButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={disabled}>
      <RotateCcw className="mr-1 h-3.5 w-3.5" />
      Undo
    </Button>
  );
}
