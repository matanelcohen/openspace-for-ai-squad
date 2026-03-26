'use client';

import {
  Code,
  Database,
  FileSearch,
  Globe,
  type LucideIcon,
  MessageSquare,
  Monitor,
  Puzzle,
  Search,
  Shield,
  TestTube,
  Upload,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  code: Code,
  'code-generation': Code,
  'code-analysis': FileSearch,
  testing: TestTube,
  deployment: Upload,
  'data-retrieval': Database,
  communication: MessageSquare,
  'file-system': FileSearch,
  search: Search,
  monitoring: Monitor,
  security: Shield,
  documentation: FileSearch,
  integration: Globe,
  database: Database,
  shield: Shield,
};

interface SkillIconProps {
  icon?: string;
  className?: string;
}

export function SkillIcon({ icon, className = 'h-5 w-5' }: SkillIconProps) {
  const Icon = (icon && iconMap[icon]) || Puzzle;
  return <Icon className={className} />;
}
