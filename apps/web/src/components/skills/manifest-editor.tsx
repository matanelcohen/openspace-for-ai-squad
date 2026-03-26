'use client';

import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import type { ValidationError } from '@/hooks/use-skill-manifest-form';

interface ManifestEditorProps {
  manifestJson: string;
  errors: ValidationError[];
  onApplyJson: (json: string) => ValidationError[];
}

export function ManifestEditor({ manifestJson, errors, onApplyJson }: ManifestEditorProps) {
  const [localJson, setLocalJson] = useState(manifestJson);
  const [jsonErrors, setJsonErrors] = useState<ValidationError[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Sync from form state when not dirty
  useEffect(() => {
    if (!isDirty) {
      setLocalJson(manifestJson);
    }
  }, [manifestJson, isDirty]);

  const handleChange = useCallback((value: string) => {
    setLocalJson(value);
    setIsDirty(true);

    // Live JSON syntax validation
    try {
      JSON.parse(value);
      setJsonErrors([]);
    } catch (e) {
      setJsonErrors([{ field: '_json', message: (e as Error).message }]);
    }
  }, []);

  const applyChanges = useCallback(() => {
    const errs = onApplyJson(localJson);
    setJsonErrors(errs.filter((e) => e.field === '_json'));
    setIsDirty(false);
  }, [localJson, onApplyJson]);

  const resetChanges = useCallback(() => {
    setLocalJson(manifestJson);
    setJsonErrors([]);
    setIsDirty(false);
  }, [manifestJson]);

  const allErrors = [...jsonErrors, ...(isDirty ? [] : errors)];
  const hasJsonSyntaxError = jsonErrors.some((e) => e.field === '_json');

  return (
    <div className="flex flex-col h-full" data-testid="manifest-editor">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium">skill.manifest.json</span>
          {isDirty && (
            <span className="text-amber-500 font-medium">• Modified</span>
          )}
        </div>
        {isDirty && (
          <div className="flex gap-1.5">
            <button
              type="button"
              className="text-xs px-2 py-1 rounded hover:bg-muted"
              onClick={resetChanges}
            >
              Discard
            </button>
            <button
              type="button"
              className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              onClick={applyChanges}
              disabled={hasJsonSyntaxError}
            >
              Apply to Form
            </button>
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <textarea
          value={localJson}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full h-full resize-none bg-background p-3 font-mono text-xs leading-relaxed focus:outline-none"
          spellCheck={false}
          data-testid="manifest-json-textarea"
        />
      </div>

      {/* Validation panel */}
      {allErrors.length > 0 ? (
        <div className="border-t bg-destructive/5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {allErrors.length} {allErrors.length === 1 ? 'issue' : 'issues'}
          </div>
          <ScrollArea className="max-h-28 px-3 pb-2">
            <ul className="space-y-0.5">
              {allErrors.map((err, i) => (
                <li key={i} className="text-xs text-destructive/80">
                  {err.field !== '_json' && (
                    <code className="text-destructive font-mono mr-1">{err.field}:</code>
                  )}
                  {err.message}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-t text-xs font-medium text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Manifest is valid
        </div>
      )}
    </div>
  );
}
