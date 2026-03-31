'use client';

import type { GalleryCategory } from '@matanelcohen/openspace-shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { GalleryCategoryCount } from '@/hooks/use-skill-gallery';

export interface GalleryCategoryNavProps {
  categories: GalleryCategoryCount[];
  selected?: GalleryCategory;
  onSelect: (category: GalleryCategory | undefined) => void;
}

export function GalleryCategoryNav({ categories, selected, onSelect }: GalleryCategoryNavProps) {
  const total = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <div
      data-testid="gallery-category-nav"
      className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin"
    >
      <Button
        variant={!selected ? 'default' : 'outline'}
        size="sm"
        className="shrink-0"
        data-testid="category-pill-all"
        onClick={() => onSelect(undefined)}
      >
        All
        <Badge variant={!selected ? 'secondary' : 'outline'} className="ml-1.5 text-xs">
          {total}
        </Badge>
      </Button>
      {categories.map((cat) => (
        <Button
          key={cat.category}
          variant={selected === cat.category ? 'default' : 'outline'}
          size="sm"
          className="shrink-0"
          data-testid={`category-pill-${cat.category}`}
          onClick={() => onSelect(cat.category)}
        >
          {cat.label}
          <Badge
            variant={selected === cat.category ? 'secondary' : 'outline'}
            className="ml-1.5 text-xs"
          >
            {cat.count}
          </Badge>
        </Button>
      ))}
    </div>
  );
}
