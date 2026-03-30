'use client';

import type { TeamMember, TeamMemberRank, TeamMemberStatus } from '@matanelcohen/openspace-shared';
import {
  DEPARTMENTS,
  TEAM_MEMBER_RANK_LABELS,
  TEAM_MEMBER_RANKS,
  TEAM_MEMBER_STATUS_LABELS,
  TEAM_MEMBER_STATUSES,
} from '@matanelcohen/openspace-shared';
import { X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type CreateTeamMemberInput,
  useCreateTeamMember,
  useUpdateTeamMember,
} from '@/hooks/use-team-members';

interface TeamMemberFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: TeamMember | null;
}

interface FormErrors {
  name?: string;
  email?: string;
}

export function TeamMemberFormDialog({ open, onOpenChange, member }: TeamMemberFormDialogProps) {
  const isEdit = !!member;
  const createMember = useCreateTeamMember();
  const updateMember = useUpdateTeamMember();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState<string>(DEPARTMENTS[0]);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [rank, setRank] = useState<TeamMemberRank>('junior');
  const [status, setStatus] = useState<TeamMemberStatus>('active');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      if (member) {
        setName(member.name);
        setEmail(member.email);
        setRole(member.role);
        setDepartment(member.department);
        setSkills([...member.skills]);
        setRank(member.rank);
        setStatus(member.status);
      } else {
        setName('');
        setEmail('');
        setRole('');
        setDepartment(DEPARTMENTS[0]);
        setSkills([]);
        setRank('junior');
        setStatus('active');
      }
      setSkillInput('');
      setErrors({});
    }
  }, [open, member]);

  const validate = useCallback((): boolean => {
    const errs: FormErrors = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!email.trim()) {
      errs.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Invalid email address';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [name, email]);

  function addSkill() {
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
    }
    setSkillInput('');
  }

  function removeSkill(skill: string) {
    setSkills(skills.filter((s) => s !== skill));
  }

  function handleSkillKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill();
    }
    if (e.key === 'Backspace' && !skillInput && skills.length > 0) {
      setSkills(skills.slice(0, -1));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload: CreateTeamMemberInput = {
      name: name.trim(),
      email: email.trim(),
      role: role.trim(),
      department,
      skills,
      rank,
      status,
    };

    if (isEdit && member) {
      updateMember.mutate(
        { memberId: member.id, ...payload },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createMember.mutate(payload, {
        onSuccess: () => onOpenChange(false),
      });
    }
  }

  const isPending = createMember.isPending || updateMember.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="team-member-form-dialog">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Member' : 'Add Member'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Update the team member details below.'
                : 'Fill in the details to add a new team member.'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Name */}
            <div className="space-y-1">
              <label htmlFor="member-name" className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="member-name"
                placeholder="Full name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                aria-invalid={!!errors.name}
                data-testid="member-name-input"
              />
              {errors.name && (
                <p className="text-xs text-destructive" data-testid="name-error">
                  {errors.name}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label htmlFor="member-email" className="text-sm font-medium">
                Email <span className="text-destructive">*</span>
              </label>
              <Input
                id="member-email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                aria-invalid={!!errors.email}
                data-testid="member-email-input"
              />
              {errors.email && (
                <p className="text-xs text-destructive" data-testid="email-error">
                  {errors.email}
                </p>
              )}
            </div>

            {/* Role */}
            <div className="space-y-1">
              <label htmlFor="member-role" className="text-sm font-medium">
                Role
              </label>
              <Input
                id="member-role"
                placeholder="e.g. Frontend Developer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                data-testid="member-role-input"
              />
            </div>

            {/* Department & Rank row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Department</label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger data-testid="member-department-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Rank</label>
                <Select value={rank} onValueChange={(v) => setRank(v as TeamMemberRank)}>
                  <SelectTrigger data-testid="member-rank-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_MEMBER_RANKS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {TEAM_MEMBER_RANK_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as TeamMemberStatus)}>
                <SelectTrigger data-testid="member-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_MEMBER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TEAM_MEMBER_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Skills */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Skills</label>
              <div className="flex flex-wrap items-center gap-1 rounded-md border p-2">
                {skills.map((s) => (
                  <Badge key={s} variant="secondary" className="gap-1 pr-1">
                    {s}
                    <button
                      type="button"
                      onClick={() => removeSkill(s)}
                      className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                      aria-label={`Remove ${s}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={handleSkillKeyDown}
                  onBlur={addSkill}
                  placeholder={skills.length === 0 ? 'Add skills...' : ''}
                  className="h-7 min-w-[80px] flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
                  data-testid="member-skill-input"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="member-submit-btn">
              {isPending ? 'Saving...' : isEdit ? 'Update Member' : 'Add Member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
