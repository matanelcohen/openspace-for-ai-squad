import type { RAGStats } from '@openspace/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IngestionStatus } from '@/components/knowledge/ingestion-status';
import { KnowledgeStats } from '@/components/knowledge/knowledge-stats';
import { RAGSearch } from '@/components/knowledge/rag-search';

// Mock the hooks
vi.mock('@/hooks/use-knowledge');

import { useKnowledgeSearch, useKnowledgeStats } from '@/hooks/use-knowledge';

const mockedUseKnowledgeStats = vi.mocked(useKnowledgeStats);
const mockedUseKnowledgeSearch = vi.mocked(useKnowledgeSearch);

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const mockStats: RAGStats = {
  totalChunks: 1250,
  chunksBySourceType: {
    commit: 400,
    pull_request: 200,
    doc: 350,
    task: 150,
    decision: 50,
    voice_session: 0,
    chat_thread: 100,
    agent_charter: 0,
    agent_memory: 0,
  },
  totalMemories: 85,
  lastIngestedAt: new Date().toISOString(),
  vectorStoreProvider: 'sqlite-vec',
  embeddingModel: 'text-embedding-3-small',
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('KnowledgeStats', () => {
  it('shows loading skeletons while fetching', () => {
    mockedUseKnowledgeStats.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useKnowledgeStats>);

    render(<KnowledgeStats />, { wrapper });
    expect(screen.getByTestId('knowledge-stats-loading')).toBeInTheDocument();
    expect(screen.getAllByTestId('knowledge-stat-skeleton')).toHaveLength(4);
  });

  it('shows error message on failure', () => {
    mockedUseKnowledgeStats.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Connection refused'),
    } as ReturnType<typeof useKnowledgeStats>);

    render(<KnowledgeStats />, { wrapper });
    expect(screen.getByTestId('knowledge-stats-error')).toBeInTheDocument();
    expect(screen.getByText(/Connection refused/)).toBeInTheDocument();
  });

  it('renders stat cards with correct values', () => {
    mockedUseKnowledgeStats.mockReturnValue({
      data: mockStats,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useKnowledgeStats>);

    render(<KnowledgeStats />, { wrapper });
    expect(screen.getByTestId('knowledge-stats')).toBeInTheDocument();
    expect(screen.getByText('Total Chunks')).toBeInTheDocument();
    expect(screen.getByText('Memories')).toBeInTheDocument();
    expect(screen.getByText('Last Sync')).toBeInTheDocument();
    expect(screen.getByText('Sources')).toBeInTheDocument();
    expect(screen.getByText('Source Breakdown')).toBeInTheDocument();
  });

  it('shows source breakdown bars for non-zero sources', () => {
    mockedUseKnowledgeStats.mockReturnValue({
      data: mockStats,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useKnowledgeStats>);

    render(<KnowledgeStats />, { wrapper });
    expect(screen.getByText('Commits')).toBeInTheDocument();
    expect(screen.getByText('Pull Requests')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
  });
});

describe('IngestionStatus', () => {
  it('shows loading skeleton while fetching', () => {
    mockedUseKnowledgeStats.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useKnowledgeStats>);

    render(<IngestionStatus />, { wrapper });
    expect(screen.getByTestId('ingestion-status-skeleton')).toBeInTheDocument();
  });

  it('shows error state on failure', () => {
    mockedUseKnowledgeStats.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Server error'),
    } as ReturnType<typeof useKnowledgeStats>);

    render(<IngestionStatus />, { wrapper });
    expect(screen.getByTestId('ingestion-status-error')).toBeInTheDocument();
  });

  it('renders ingestion status for all source types', () => {
    mockedUseKnowledgeStats.mockReturnValue({
      data: mockStats,
      isLoading: false,
      error: null,
      dataUpdatedAt: Date.now(),
    } as ReturnType<typeof useKnowledgeStats>);

    render(<IngestionStatus />, { wrapper });
    expect(screen.getByTestId('ingestion-status')).toBeInTheDocument();
    expect(screen.getByText('Commits')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    // Non-ingested sources should show "Not ingested"
    expect(screen.getAllByText('Not ingested')).toHaveLength(3);
  });
});

describe('RAGSearch', () => {
  beforeEach(() => {
    mockedUseKnowledgeSearch.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useKnowledgeSearch>);
  });

  it('renders search input and button', () => {
    render(<RAGSearch />, { wrapper });
    expect(screen.getByTestId('rag-search')).toBeInTheDocument();
    expect(screen.getByTestId('rag-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('rag-search-button')).toBeInTheDocument();
  });

  it('shows empty state before searching', () => {
    render(<RAGSearch />, { wrapper });
    expect(screen.getByTestId('rag-search-empty')).toBeInTheDocument();
    expect(screen.getByText(/Enter a query/)).toBeInTheDocument();
  });

  it('disables search button when input is empty', () => {
    render(<RAGSearch />, { wrapper });
    expect(screen.getByTestId('rag-search-button')).toBeDisabled();
  });

  it('shows loading state while searching', () => {
    mockedUseKnowledgeSearch.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
      error: null,
    } as unknown as ReturnType<typeof useKnowledgeSearch>);

    render(<RAGSearch />, { wrapper });
    expect(screen.getByText('Searching')).toBeInTheDocument();
  });

  it('shows error message on search failure', () => {
    mockedUseKnowledgeSearch.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: new Error('Search failed'),
    } as unknown as ReturnType<typeof useKnowledgeSearch>);

    render(<RAGSearch />, { wrapper });
    expect(screen.getByText('Search failed')).toBeInTheDocument();
  });
});
