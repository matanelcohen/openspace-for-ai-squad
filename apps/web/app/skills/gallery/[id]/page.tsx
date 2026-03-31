'use client';

import type { GalleryCategory } from '@matanelcohen/openspace-shared';
import { ArrowLeft, Calendar, Check, Download, Loader2, Star, Tag, User } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useGallerySkillDetail, useInstallGallerySkill } from '@/hooks/use-skill-gallery';
import { useSkills } from '@/hooks/use-skills';

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

function formatDate(ts: number | string): string {
  const date = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function GallerySkillDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: skill, isLoading, error } = useGallerySkillDetail(params.id);
  const { data: installedSkills } = useSkills();
  const install = useInstallGallerySkill();
  const [justInstalled, setJustInstalled] = useState(false);

  const isInstalled =
    justInstalled || installedSkills?.some((s) => s.id === params.id || s.name === skill?.name);

  const handleInstall = async () => {
    try {
      await install.mutateAsync(params.id);
      setJustInstalled(true);
    } catch {
      // Error handled by react-query
    }
  };

  if (isLoading) {
    return <LoadingSpinner size="lg" message="Loading skill details..." />;
  }

  if (error || !skill) {
    return (
      <div className="space-y-4">
        <Link href="/skills?tab=gallery">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Gallery
          </Button>
        </Link>
        <p className="text-sm text-destructive">{error?.message ?? 'Skill not found.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/skills?tab=gallery">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Gallery
        </Button>
      </Link>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Main content */}
        <div className="flex-1 space-y-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-3xl">
              {skill.icon || '🔧'}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{skill.name}</h1>
                {skill.featured && (
                  <Badge variant="outline" className="gap-1 border-yellow-400 text-yellow-600">
                    <Star className="h-3 w-3 fill-yellow-400" />
                    Featured
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">{skill.description}</p>
            </div>
          </div>

          {skill.documentation && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Documentation</h2>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {skill.documentation}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <Card className="w-full md:w-80 shrink-0">
          <CardContent className="space-y-4 pt-6">
            <Button
              className="w-full"
              size="lg"
              variant={isInstalled ? 'secondary' : 'default'}
              disabled={isInstalled || install.isPending}
              onClick={handleInstall}
              data-testid="gallery-detail-install"
            >
              {install.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Installing…
                </>
              ) : isInstalled ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Installed
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Install Skill
                </>
              )}
            </Button>

            <div className="space-y-3 text-sm">
              {skill.author && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Author</span>
                  <span className="ml-auto font-medium">{skill.author}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Version</span>
                <span className="ml-auto font-medium">v{skill.version}</span>
              </div>
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Installs</span>
                <span className="ml-auto font-medium">{skill.installCount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Added</span>
                <span className="ml-auto font-medium">{formatDate(skill.addedAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Updated</span>
                <span className="ml-auto font-medium">{formatDate(skill.updatedAt)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium">Category</span>
              <div>
                <Badge
                  className={`text-xs border-0 ${categoryColors[skill.category as GalleryCategory] ?? categoryColors.other}`}
                >
                  {skill.category}
                </Badge>
              </div>
            </div>

            {skill.tags.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-medium">Tags</span>
                <div className="flex flex-wrap gap-1">
                  {skill.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
