'use client';

import type { RAGSearchResponse, RetrievedChunk, SourceType } from '@openspace/shared';
import { AlertCircle, Clock, FileText, Loader2, Search, Sparkles, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useKnowledgeSearch } from '@/hooks/use-knowledge';
import { cn } from '@/lib/utils';

const sourceTypeIcons: Record<SourceType, string> = {
  commit: '🔀',
  pull_request: '🔃',
  doc: '📄',
  task: '✅',
  decision: '⚖️',
  voice_session: '🎙️',
  chat_thread: '💬',
  agent_charter: '📋',
  agent_memory: '🧠',
};

function scoreColor(score: number): string {
  if (score >= 0.8) return 'text-green-600 dark:text-green-400';
  if (score >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBgColor(score: number): string {
  if (score >= 0.8) return 'bg-green-500';
  if (score >= 0.5) return 'bg-yellow-500';
  return 'bg-red-500';
}

function ResultCard({ chunk, index }: { chunk: RetrievedChunk; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const sourceType = chunk.metadata?.sourceType as SourceType | undefined;
  const score = chunk.score ?? 0;
  const content = chunk.content ?? '';
  const truncatedContent =
    content.length > 200 && !expanded ? content.slice(0, 200) + '…' : content;

  return (
    <div
      className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
      data-testid={`search-result-${index}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Source info */}
          <div className="flex items-center gap-2 mb-2">
            {sourceType && (
              <Badge variant="secondary" className="text-xs gap-1">
                <span>{sourceTypeIcons[sourceType] ?? '📎'}</span>
                {sourceType.replace(/_/g, ' ')}
              </Badge>
            )}
            {chunk.metadata?.sourceId && (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                {chunk.metadata.sourceId}
              </span>
            )}
            {chunk.citationIndex !== undefined && (
              <Badge variant="outline" className="text-xs">
                [{chunk.citationIndex}]
              </Badge>
            )}
          </div>

          {/* Content */}
          <p className="text-sm whitespace-pre-wrap break-words">{truncatedContent}</p>
          {content.length > 200 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}

          {/* Metadata tags */}
          <div className="flex flex-wrap gap-1 mt-2">
            {(Array.isArray(chunk.metadata?.tags) ? chunk.metadata.tags : []).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
            {(Array.isArray(chunk.metadata?.agentIds) ? chunk.metadata.agentIds : []).map((agentId) => (
              <Badge key={agentId} variant="secondary" className="text-[10px] px-1.5 py-0">
                🤖 {agentId}
              </Badge>
            ))}
          </div>
        </div>

        {/* Relevance score */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={cn('text-sm font-bold tabular-nums', scoreColor(score))}>
            {(score * 100).toFixed(1)}%
          </span>
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', scoreBgColor(score))}
              style={{ width: `${score * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function RAGSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RAGSearchResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutate: search, isPending, error } = useKnowledgeSearch();

  const handleSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    search(
      { query: trimmed, limit: 20, hybridSearch: true },
      {
        onSuccess: (data) => setResults(data),
      },
    );
  }, [query, search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleClear = () => {
    setQuery('');
    setResults(null);
    inputRef.current?.focus();
  };

  return (
    <Card data-testid="rag-search">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-500" />
          Similarity Search
        </CardTitle>
        <CardDescription>Test RAG queries against the knowledge base</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search knowledge base… e.g. 'How does authentication work?'"
              className="pl-9 pr-8"
              data-testid="rag-search-input"
            />
            {query && (
              <button
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            onClick={handleSearch}
            disabled={isPending || !query.trim()}
            data-testid="rag-search-button"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching
              </>
            ) : (
              'Search'
            )}
          </Button>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error.message}
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-3" data-testid="rag-search-results">
            {/* Result metadata */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>
                  <span className="font-medium text-foreground">
                    {results.results?.length ?? 0}
                  </span>{' '}
                  results
                </span>
                {results.totalTokens != null && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {results.totalTokens.toLocaleString()} tokens
                  </span>
                )}
              </div>
              {results.searchTimeMs != null && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {results.searchTimeMs}ms
                </span>
              )}
            </div>

            {/* Source attribution */}
            {results.sources && results.sources.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {results.sources.map((source) => (
                  <Badge key={source.citationIndex} variant="outline" className="text-xs gap-1">
                    <span className="font-mono">[{source.citationIndex}]</span>
                    <span>{sourceTypeIcons[source.sourceType as SourceType] ?? '📎'}</span>
                    <span className="truncate max-w-[150px]">
                      {source.title ?? source.sourceId}
                    </span>
                  </Badge>
                ))}
              </div>
            )}

            {/* Result cards */}
            {results.results && results.results.length > 0 ? (
              <div className="space-y-2">
                {results.results.map((chunk, i) => (
                  <ResultCard key={chunk.citationIndex ?? i} chunk={chunk} index={i} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No results found. Try a different query or adjust filters.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty state (before searching) */}
        {!results && !isPending && !error && (
          <div
            className="rounded-lg border border-dashed p-8 text-center"
            data-testid="rag-search-empty"
          >
            <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              Enter a query to search the knowledge base using semantic similarity.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Results include relevance scores, source attribution, and content previews.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
