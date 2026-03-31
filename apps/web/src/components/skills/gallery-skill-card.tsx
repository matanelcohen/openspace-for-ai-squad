'use client';

import { Check, Download, Loader2, Star } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import type { GallerySkillItem } from '@/hooks/use-skill-gallery';
import { useInstallGallerySkill } from '@/hooks/use-skill-gallery';

export interface GallerySkillCardProps {
  skill: GallerySkillItem;
  isInstalled?: boolean;
}

const categoryColors: Record<string, string> = {
  'code-quality': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  testing: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  devops: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  documentation: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  security: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  productivity: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  data: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
  communication: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
  'ai-ml': 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

export function GallerySkillCard({ skill, isInstalled }: GallerySkillCardProps) {
  const install = useInstallGallerySkill();
  const [justInstalled, setJustInstalled] = useState(false);

  const handleInstall = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await install.mutateAsync(skill.id);
      setJustInstalled(true);
    } catch {
      // Error handled by react-query
    }
  };

  const installed = isInstalled || justInstalled;

  return (
    <Link href={`/skills/gallery/${skill.id}`} data-testid={`gallery-skill-card-${skill.id}`}>
      <Card className="h-full transition-all hover:shadow-md hover:border-primary/30 cursor-pointer">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl">
            {skill.icon || '🔧'}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold leading-none truncate">{skill.name}</h3>
              {skill.featured && (
                <Badge
                  variant="outline"
                  className="gap-1 shrink-0 border-yellow-400 text-yellow-600"
                  data-testid="featured-badge"
                >
                  <Star className="h-3 w-3 fill-yellow-400" />
                  Featured
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">v{skill.version}</p>
              {skill.author && (
                <p className="text-xs text-muted-foreground truncate">by {skill.author}</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <p className="text-sm text-muted-foreground line-clamp-2">{skill.description}</p>
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-2 pt-0">
          <div className="flex flex-wrap gap-1">
            <Badge
              className={`text-xs border-0 ${categoryColors[skill.category] ?? categoryColors.other}`}
              data-testid="category-badge"
            >
              {skill.category}
            </Badge>
            {skill.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {skill.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{skill.tags.length - 3}
              </Badge>
            )}
          </div>
          <div className="flex w-full items-center justify-between">
            <div
              className="flex items-center gap-1 text-xs text-muted-foreground"
              data-testid="install-count"
            >
              <Download className="h-3 w-3" />
              <span>{skill.installCount.toLocaleString()}</span>
            </div>
            <Button
              size="sm"
              variant={installed ? 'secondary' : 'default'}
              disabled={installed || install.isPending}
              onClick={handleInstall}
              data-testid={installed ? 'installed-badge' : 'install-button'}
            >
              {install.isPending ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Installing
                </>
              ) : installed ? (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  Installed
                </>
              ) : (
                <>
                  <Download className="mr-1 h-3 w-3" />
                  Install
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
