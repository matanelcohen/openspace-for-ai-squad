'use client';

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  FileJson,
  MessageSquare,
  Plus,
  Settings,
  Sparkles,
  Target,
  Wrench,
} from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSkillManifestForm, type ValidationError } from '@/hooks/use-skill-manifest-form';
import { useCreateSkill } from '@/hooks/use-skills';
import { cn } from '@/lib/utils';

import { ManifestEditor } from './manifest-editor';
import { SkillCardPreview } from './skill-card-preview';
import { WizardStepBasics } from './wizard-step-basics';
import { WizardStepConfig } from './wizard-step-config';
import { WizardStepPrompts } from './wizard-step-prompts';
import { WizardStepTools } from './wizard-step-tools';
import { WizardStepTriggers } from './wizard-step-triggers';

// ── Step definitions ─────────────────────────────────────────────

const STEPS = [
  { id: 'basics', label: 'Basics', icon: Sparkles, description: 'Name, version & metadata' },
  { id: 'tools', label: 'Tools', icon: Wrench, description: 'Required tool declarations' },
  { id: 'triggers', label: 'Triggers', icon: Target, description: 'Activation rules' },
  { id: 'prompts', label: 'Prompts', icon: MessageSquare, description: 'Prompt templates' },
  { id: 'config', label: 'Config', icon: Settings, description: 'User parameters' },
] as const;

// ── Component ────────────────────────────────────────────────────

interface SkillCreationWizardProps {
  trigger?: React.ReactNode;
  onCreated?: (skillId: string) => void;
}

export function SkillCreationWizard({ trigger, onCreated }: SkillCreationWizardProps) {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [editorTab, setEditorTab] = useState<'form' | 'json'>('form');
  const [submitted, setSubmitted] = useState(false);

  const form = useSkillManifestForm();
  const createSkill = useCreateSkill();

  const stepErrors = form.getStepErrors(currentStep);
  const canProceed = stepErrors.length === 0;

  const goToStep = useCallback((step: number) => {
    setCurrentStep(Math.max(0, Math.min(step, STEPS.length - 1)));
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      goToStep(currentStep + 1);
    }
  }, [currentStep, goToStep]);

  const handleBack = useCallback(() => {
    goToStep(currentStep - 1);
  }, [currentStep, goToStep]);

  const handleSubmit = useCallback(async () => {
    setSubmitted(true);
    if (!form.isValid) return;

    try {
      const result = await createSkill.mutateAsync(
        form.manifest as unknown as Parameters<typeof createSkill.mutateAsync>[0],
      );
      setOpen(false);
      setCurrentStep(0);
      form.reset();
      setSubmitted(false);
      onCreated?.(result.id);
    } catch {
      // Error is handled by react-query
    }
  }, [form, createSkill, onCreated]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        setCurrentStep(0);
        setSubmitted(false);
        form.reset();
      }
    },
    [form],
  );

  const handleApplyJson = useCallback(
    (json: string): ValidationError[] => {
      return form.loadFromJson(json);
    },
    [form],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button data-testid="create-skill-btn">
            <Plus className="h-4 w-4 mr-2" />
            Create Skill
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="max-w-6xl h-[85vh] md:h-[85vh] h-[95vh] flex flex-col p-0 gap-0 w-[95vw] md:w-auto"
        data-testid="skill-creation-wizard"
      >
        <DialogHeader className="px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4 border-b">
          <DialogTitle>Create New Skill</DialogTitle>
          <DialogDescription className="hidden md:block">
            Build a skill manifest that defines capabilities, triggers, and prompts for your agents.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 flex-col md:flex-row">
          {/* Step navigation — horizontal on mobile, sidebar on desktop */}
          <nav
            className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r bg-muted/20 py-2 md:py-4 overflow-x-auto md:overflow-x-visible"
            aria-label="Wizard steps"
          >
            <ul className="flex md:flex-col gap-1 px-2 md:space-y-1">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const errors = form.getStepErrors(index);
                const isComplete = errors.length === 0 && submitted;
                const isCurrent = index === currentStep;

                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      className={cn(
                        'w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
                        isCurrent
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                      onClick={() => goToStep(index)}
                      data-testid={`wizard-step-nav-${step.id}`}
                    >
                      <div
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                          isCurrent
                            ? 'bg-primary text-primary-foreground'
                            : isComplete
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : errors.length > 0 && submitted
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {isComplete ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Icon className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="min-w-0 hidden md:block">
                        <div className="truncate">{step.label}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {step.description}
                        </div>
                      </div>
                      <span className="md:hidden text-xs whitespace-nowrap">{step.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Center: Form / JSON editor */}
          <div className="flex-1 min-w-0 flex flex-col">
            <Tabs
              value={editorTab}
              onValueChange={(v) => setEditorTab(v as 'form' | 'json')}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="border-b px-4">
                <TabsList className="h-9">
                  <TabsTrigger value="form" className="text-xs gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Visual Editor
                  </TabsTrigger>
                  <TabsTrigger value="json" className="text-xs gap-1.5">
                    <Code2 className="h-3.5 w-3.5" />
                    JSON Editor
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="form" className="flex-1 min-h-0 m-0">
                <ScrollArea className="h-full p-6">
                  {currentStep === 0 && (
                    <WizardStepBasics
                      state={form.state}
                      setField={form.setField}
                      getFieldError={form.getFieldError}
                    />
                  )}
                  {currentStep === 1 && (
                    <WizardStepTools
                      state={form.state}
                      dispatch={form.dispatch}
                      getFieldError={form.getFieldError}
                    />
                  )}
                  {currentStep === 2 && (
                    <WizardStepTriggers
                      state={form.state}
                      dispatch={form.dispatch}
                      getFieldError={form.getFieldError}
                    />
                  )}
                  {currentStep === 3 && (
                    <WizardStepPrompts
                      state={form.state}
                      dispatch={form.dispatch}
                      getFieldError={form.getFieldError}
                    />
                  )}
                  {currentStep === 4 && (
                    <WizardStepConfig
                      state={form.state}
                      dispatch={form.dispatch}
                      getFieldError={form.getFieldError}
                    />
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="json" className="flex-1 min-h-0 m-0">
                <ManifestEditor
                  manifestJson={form.manifestJson}
                  errors={form.errors}
                  onApplyJson={handleApplyJson}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Right sidebar: Preview */}
          <div className="w-72 shrink-0 border-l bg-muted/10 p-4 overflow-auto">
            <SkillCardPreview state={form.state} />
          </div>
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-t bg-muted/20">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleBack}
            disabled={currentStep === 0}
            data-testid="wizard-back-btn"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            Step {currentStep + 1} of {STEPS.length}
            {!canProceed && submitted && (
              <span className="text-destructive">
                • {stepErrors.length} {stepErrors.length === 1 ? 'issue' : 'issues'}
              </span>
            )}
          </div>

          {currentStep < STEPS.length - 1 ? (
            <Button type="button" size="sm" onClick={handleNext} data-testid="wizard-next-btn">
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={createSkill.isPending}
              data-testid="wizard-submit-btn"
            >
              {createSkill.isPending ? (
                <>Creating...</>
              ) : (
                <>
                  <FileJson className="h-4 w-4 mr-1" />
                  Create Skill
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
