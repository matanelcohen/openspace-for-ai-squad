import { IngestionStatus } from '@/components/knowledge/ingestion-status';
import { KnowledgeStats } from '@/components/knowledge/knowledge-stats';
import { RAGSearch } from '@/components/knowledge/rag-search';

export default function KnowledgePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
        <p className="text-muted-foreground">Monitor, query, and debug the RAG knowledge system.</p>
      </div>
      <KnowledgeStats />
      <div className="grid gap-6 lg:grid-cols-[1fr,340px]">
        <RAGSearch />
        <IngestionStatus />
      </div>
    </div>
  );
}
