'use client';

import { AlertCircle, Check, Download, Github, Loader2, Search } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ScannedGitHubSkill } from '@/hooks/use-skills';
import { useImportSkills, useScanGitHubSkills } from '@/hooks/use-skills';
import { cn } from '@/lib/utils';

type Step = 'url' | 'pick' | 'importing' | 'done';

export function SkillImportDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('url');
  const [url, setUrl] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importResults, setImportResults] = useState<{
    imported: Array<{ id: string; name: string }>;
    errors: Array<{ id: string; error: string }>;
  } | null>(null);

  const scan = useScanGitHubSkills();
  const importSkills = useImportSkills();

  const skills = scan.data?.skills ?? [];
  const source = scan.data?.source;

  const resetState = useCallback(() => {
    setStep('url');
    setUrl('');
    setSelected(new Set());
    setImportResults(null);
    scan.reset();
    importSkills.reset();
  }, [scan, importSkills]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) resetState();
    },
    [resetState],
  );

  const handleScan = useCallback(async () => {
    if (!url.trim()) return;
    try {
      const result = await scan.mutateAsync(url.trim());
      if (result.skills.length > 0) {
        setSelected(new Set(result.skills.map((s) => s.id)));
        setStep('pick');
      }
    } catch {
      // Error displayed via scan.error
    }
  }, [url, scan]);

  const toggleSkill = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === skills.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(skills.map((s) => s.id)));
    }
  }, [selected.size, skills]);

  const handleImport = useCallback(async () => {
    if (!source || selected.size === 0) return;
    setStep('importing');
    try {
      const result = await importSkills.mutateAsync({
        source: { owner: source.owner, repo: source.repo },
        skills: skills.filter((s) => selected.has(s.id)).map((s) => ({ id: s.id, path: s.path })),
      });
      setImportResults(result);
      setStep('done');
    } catch {
      setStep('pick');
    }
  }, [source, selected, skills, importSkills]);

  const renderUrlStep = () => (
    <div className="space-y-4 p-6">
      <div className="space-y-2">
        <label htmlFor="github-url" className="text-sm font-medium">
          GitHub Repository URL
        </label>
        <div className="flex gap-2">
          <Input
            id="github-url"
            placeholder="https://github.com/owner/repo/tree/main/skills"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleScan();
            }}
            disabled={scan.isPending}
            data-testid="import-url-input"
          />
          <Button
            onClick={handleScan}
            disabled={!url.trim() || scan.isPending}
            data-testid="import-scan-btn"
          >
            {scan.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span className="ml-2">Scan</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Paste a link to a GitHub directory containing skill folders with SKILL.md files.
        </p>
      </div>

      {scan.isError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{(scan.error as Error).message}</span>
        </div>
      )}

      {scan.isSuccess && skills.length === 0 && (
        <div className="flex items-start gap-2 rounded-md border p-3 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            No skills found. Make sure the directory contains subdirectories with SKILL.md files.
          </span>
        </div>
      )}
    </div>
  );

  const renderPickStep = () => (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center justify-between px-6 py-3 border-b">
        <span className="text-sm text-muted-foreground">
          {selected.size} of {skills.length} selected
        </span>
        <Button variant="ghost" size="sm" onClick={toggleAll} data-testid="import-toggle-all">
          {selected.size === skills.length ? 'Deselect All' : 'Select All'}
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0 max-h-[400px]">
        <div className="divide-y">
          {skills.map((skill) => (
            <SkillPickerRow
              key={skill.id}
              skill={skill}
              checked={selected.has(skill.id)}
              onToggle={() => toggleSkill(skill.id)}
            />
          ))}
        </div>
      </ScrollArea>

      <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/20">
        <Button variant="outline" onClick={() => setStep('url')} data-testid="import-back-btn">
          Back
        </Button>
        <Button
          onClick={handleImport}
          disabled={selected.size === 0}
          data-testid="import-confirm-btn"
        >
          <Download className="h-4 w-4 mr-2" />
          Import {selected.size} {selected.size === 1 ? 'Skill' : 'Skills'}
        </Button>
      </div>
    </div>
  );

  const renderImportingStep = () => (
    <div className="flex flex-col items-center justify-center gap-4 p-10">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <div className="text-center">
        <p className="font-medium">Importing skills...</p>
        <p className="text-sm text-muted-foreground">
          Downloading {selected.size} {selected.size === 1 ? 'skill' : 'skills'} from GitHub
        </p>
      </div>
    </div>
  );

  const renderDoneStep = () => {
    const importedCount = importResults?.imported.length ?? 0;
    const errorCount = importResults?.errors.length ?? 0;

    return (
      <div className="space-y-4 p-6">
        {importedCount > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-green-600">
              <Check className="h-4 w-4" />
              {importedCount} {importedCount === 1 ? 'skill' : 'skills'} imported successfully
            </div>
            <div className="flex flex-wrap gap-1.5">
              {importResults?.imported.map((s) => (
                <Badge key={s.id} variant="secondary">
                  {s.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {errorCount > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertCircle className="h-4 w-4" />
              {errorCount} {errorCount === 1 ? 'skill' : 'skills'} failed
            </div>
            {importResults?.errors.map((e) => (
              <p key={e.id} className="text-xs text-muted-foreground">
                <span className="font-mono">{e.id}</span>: {e.error}
              </p>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={() => setOpen(false)} data-testid="import-done-btn">
            Done
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="import-from-github-btn">
          <Github className="h-4 w-4 mr-2" />
          Import from GitHub
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0"
        data-testid="skill-import-dialog"
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Import Skills from GitHub</DialogTitle>
          <DialogDescription>
            {step === 'url' && 'Paste a GitHub URL to scan for importable skills.'}
            {step === 'pick' && `Found ${skills.length} skills. Select which ones to import.`}
            {step === 'importing' && 'Importing selected skills...'}
            {step === 'done' && 'Import complete.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'url' && renderUrlStep()}
        {step === 'pick' && renderPickStep()}
        {step === 'importing' && renderImportingStep()}
        {step === 'done' && renderDoneStep()}
      </DialogContent>
    </Dialog>
  );
}

// ── Sub-component ────────────────────────────────────────────────

function SkillPickerRow({
  skill,
  checked,
  onToggle,
}: {
  skill: ScannedGitHubSkill;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex w-full items-start gap-3 px-6 py-3 text-left transition-colors hover:bg-muted/50',
        checked && 'bg-primary/5',
      )}
      data-testid={`import-skill-${skill.id}`}
    >
      <div
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
          checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-input bg-background',
        )}
      >
        {checked && <Check className="h-3 w-3" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{skill.name}</p>
        {skill.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{skill.description}</p>
        )}
        <p className="text-xs text-muted-foreground/60 font-mono mt-1">{skill.path}</p>
      </div>
    </button>
  );
}
