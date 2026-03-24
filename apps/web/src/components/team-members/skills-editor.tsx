'use client';

import { Plus, X } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SkillsEditorProps {
  skills: string[];
  onSkillsChange: (skills: string[]) => void;
  editable?: boolean;
  className?: string;
}

export function SkillsEditor({
  skills,
  onSkillsChange,
  editable = true,
  className,
}: SkillsEditorProps) {
  const [newSkill, setNewSkill] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    const trimmed = newSkill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      onSkillsChange([...skills, trimmed]);
    }
    setNewSkill('');
    setIsAdding(false);
  };

  const handleRemove = (skill: string) => {
    onSkillsChange(skills.filter((s) => s !== skill));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Escape') {
      setNewSkill('');
      setIsAdding(false);
    }
  };

  return (
    <div className={cn('space-y-2', className)} data-testid="skills-editor">
      <div className="flex flex-wrap gap-1.5">
        {skills.map((skill) => (
          <Badge
            key={skill}
            variant="secondary"
            className={cn('text-xs', editable && 'pr-1 gap-1')}
          >
            {skill}
            {editable && (
              <button
                type="button"
                onClick={() => handleRemove(skill)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                aria-label={`Remove ${skill}`}
                data-testid={`remove-skill-${skill}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
        {skills.length === 0 && !editable && (
          <span className="text-sm text-muted-foreground">No skills listed</span>
        )}
      </div>

      {editable && (
        <div>
          {isAdding ? (
            <div className="flex items-center gap-2">
              <Input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  if (!newSkill.trim()) setIsAdding(false);
                }}
                placeholder="Type a skill…"
                className="h-8 w-48 text-sm"
                autoFocus
                data-testid="skill-input"
              />
              <Button size="sm" variant="outline" onClick={handleAdd} className="h-8">
                Add
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAdding(true)}
              className="h-7 gap-1 text-xs text-muted-foreground"
              data-testid="add-skill-button"
            >
              <Plus className="h-3 w-3" />
              Add Skill
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
