'use client';

import type { SandboxRuntime } from '@openspace/shared';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const RUNTIMES: { value: SandboxRuntime; label: string; icon: string }[] = [
  { value: 'node', label: 'Node.js', icon: '⬢' },
  { value: 'python', label: 'Python', icon: '🐍' },
  { value: 'go', label: 'Go', icon: '🔷' },
];

interface RuntimeSelectorProps {
  value: SandboxRuntime;
  onValueChange: (runtime: SandboxRuntime) => void;
  disabled?: boolean;
}

export function RuntimeSelector({ value, onValueChange, disabled }: RuntimeSelectorProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="w-[160px] h-9" data-testid="runtime-selector">
        <SelectValue placeholder="Select runtime" />
      </SelectTrigger>
      <SelectContent>
        {RUNTIMES.map((rt) => (
          <SelectItem key={rt.value} value={rt.value} data-testid={`runtime-${rt.value}`}>
            <span className="flex items-center gap-2">
              <span>{rt.icon}</span>
              <span>{rt.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
