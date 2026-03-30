'use client';

import type { SandboxRuntime } from '@openspace/shared';
import { Play, RotateCcw } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Language = 'javascript' | 'typescript' | 'python' | 'go' | 'bash' | 'json';

interface CodeEditorProps {
  initialCode?: string;
  language?: Language;
  runtime?: SandboxRuntime;
  onRun?: (code: string, language: Language) => void;
  isRunning?: boolean;
  readOnly?: boolean;
  className?: string;
}

const LANGUAGE_OPTIONS: { value: Language; label: string; ext: string }[] = [
  { value: 'javascript', label: 'JavaScript', ext: '.js' },
  { value: 'typescript', label: 'TypeScript', ext: '.ts' },
  { value: 'python', label: 'Python', ext: '.py' },
  { value: 'go', label: 'Go', ext: '.go' },
  { value: 'bash', label: 'Bash', ext: '.sh' },
  { value: 'json', label: 'JSON', ext: '.json' },
];

const RUNTIME_DEFAULT_LANG: Record<SandboxRuntime, Language> = {
  node: 'javascript',
  python: 'python',
  go: 'go',
};

const LANGUAGE_PLACEHOLDERS: Record<Language, string> = {
  javascript: '// Write JavaScript code here\nconsole.log("Hello, sandbox!");',
  typescript: '// Write TypeScript code here\nconst greeting: string = "Hello, sandbox!";\nconsole.log(greeting);',
  python: '# Write Python code here\nprint("Hello, sandbox!")',
  go: '// Write Go code here\npackage main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello, sandbox!")\n}',
  bash: '#!/bin/bash\necho "Hello, sandbox!"',
  json: '{\n  "hello": "sandbox"\n}',
};

function buildRunCommand(code: string, language: Language): string {
  switch (language) {
    case 'javascript':
      return `node -e ${JSON.stringify(code)}`;
    case 'typescript':
      return `cat > /tmp/_run.ts << 'SANDBOX_EOF'\n${code}\nSANDBOX_EOF\nnpx ts-node /tmp/_run.ts`;
    case 'python':
      return `python3 -c ${JSON.stringify(code)}`;
    case 'go':
      return `cat > /tmp/_run.go << 'SANDBOX_EOF'\n${code}\nSANDBOX_EOF\ncd /tmp && go run _run.go`;
    case 'bash':
      return code;
    case 'json':
      return `echo ${JSON.stringify(code)} | python3 -m json.tool`;
    default:
      return code;
  }
}

export { buildRunCommand };

export function CodeEditor({
  initialCode = '',
  language: initialLang,
  runtime,
  onRun,
  isRunning,
  readOnly,
  className,
}: CodeEditorProps) {
  const defaultLang = initialLang ?? (runtime ? RUNTIME_DEFAULT_LANG[runtime] : 'javascript');
  const [language, setLanguage] = useState<Language>(defaultLang);
  const [code, setCode] = useState(initialCode || LANGUAGE_PLACEHOLDERS[defaultLang]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lineCount = useMemo(() => code.split('\n').length, [code]);

  const handleRun = useCallback(() => {
    if (!onRun || !code.trim()) return;
    onRun(code, language);
  }, [onRun, code, language]);

  const handleReset = useCallback(() => {
    setCode(LANGUAGE_PLACEHOLDERS[language]);
  }, [language]);

  const handleLanguageChange = useCallback(
    (lang: Language) => {
      setLanguage(lang);
      if (code === LANGUAGE_PLACEHOLDERS[language] || !code.trim()) {
        setCode(LANGUAGE_PLACEHOLDERS[lang]);
      }
    },
    [code, language],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd/Ctrl+Enter to run
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
        return;
      }

      // Tab support
      if (e.key === 'Tab') {
        e.preventDefault();
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newCode = code.substring(0, start) + '  ' + code.substring(end);
        setCode(newCode);
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        });
      }
    },
    [handleRun, code],
  );

  return (
    <div
      className={cn('flex flex-col rounded-md border bg-background', className)}
      data-testid="code-editor"
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <div className="flex items-center gap-2">
          <Select value={language} onValueChange={(v) => handleLanguageChange(v as Language)}>
            <SelectTrigger className="h-7 w-[140px] text-xs" data-testid="code-language-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{lineCount} lines</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleReset}
            disabled={readOnly}
            title="Reset to placeholder"
            data-testid="code-reset"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>

          {onRun && (
            <Button
              size="sm"
              className="h-7 gap-1.5 px-3 text-xs"
              onClick={handleRun}
              disabled={isRunning || !code.trim()}
              data-testid="code-run"
            >
              <Play className="h-3 w-3" />
              {isRunning ? 'Running…' : 'Run'}
            </Button>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className="relative flex flex-1 min-h-0">
        {/* Line numbers */}
        <div
          className="shrink-0 select-none border-r bg-muted/30 px-2 py-3 font-mono text-xs leading-5 text-muted-foreground/50 text-right"
          aria-hidden="true"
          data-testid="code-line-numbers"
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          spellCheck={false}
          className={cn(
            'flex-1 resize-none bg-[#1e1e1e] p-3 font-mono text-xs leading-5 text-[#d4d4d4] outline-none',
            'placeholder:text-[#555]',
            readOnly && 'cursor-default opacity-80',
          )}
          placeholder="Write code here…"
          data-testid="code-textarea"
        />
      </div>

      {/* Footer hint */}
      <div className="border-t bg-muted/20 px-3 py-1 text-[10px] text-muted-foreground/60">
        <kbd className="rounded border border-border/50 bg-muted px-1">⌘</kbd>+
        <kbd className="rounded border border-border/50 bg-muted px-1">Enter</kbd> to run
        &nbsp;•&nbsp;
        <kbd className="rounded border border-border/50 bg-muted px-1">Tab</kbd> to indent
      </div>
    </div>
  );
}
