/**
 * SkillGalleryService — manages the public skill catalog for browse, search, and install.
 *
 * The gallery is a curated catalog of community skills stored in SQLite.
 * Skills can be installed from the gallery into the local skill registry.
 *
 * On first run, the catalog is seeded with a built-in set of community skills.
 * The catalog can be refreshed from GitHub sources via the refresh() method.
 */

import type Database from 'better-sqlite3';

import type {
  GalleryCategory,
  GallerySearchParams,
  GallerySearchResult,
  GallerySkill,
} from '@matanelcohen/openspace-shared';
import { GALLERY_CATEGORIES } from '@matanelcohen/openspace-shared';

// ── Seed Catalog ────────────────────────────────────────────────────

interface SeedSkill {
  id: string;
  name: string;
  description: string;
  author: string;
  category: GalleryCategory;
  tags: string[];
  icon: string;
  version: string;
  sourceUrl: string;
  sourcePath: string;
  sourceRef: string;
  featured: boolean;
}

const SEED_SKILLS: SeedSkill[] = [
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Automated code review that checks for bugs, security vulnerabilities, and style issues. Supports configurable rulesets.',
    author: 'openspace-community',
    category: 'code-quality',
    tags: ['code', 'review', 'quality', 'bugs', 'linting'],
    icon: '🔍',
    version: '1.2.0',
    sourceUrl: 'https://github.com/openspace-ai/skill-catalog',
    sourcePath: 'skills/code-review',
    sourceRef: 'main',
    featured: true,
  },
  {
    id: 'test-runner',
    name: 'Test Runner',
    description: 'Execute and manage test suites across multiple frameworks. Supports vitest, jest, pytest, and go test.',
    author: 'openspace-community',
    category: 'testing',
    tags: ['test', 'testing', 'vitest', 'jest', 'pytest', 'coverage'],
    icon: '🧪',
    version: '1.1.0',
    sourceUrl: 'https://github.com/openspace-ai/skill-catalog',
    sourcePath: 'skills/test-runner',
    sourceRef: 'main',
    featured: true,
  },
  {
    id: 'git-expert',
    name: 'Git Expert',
    description: 'Advanced git operations — branch management, conflict resolution, interactive rebase, and history analysis.',
    author: 'openspace-community',
    category: 'devops',
    tags: ['git', 'version-control', 'branching', 'merge', 'rebase'],
    icon: '🔀',
    version: '1.0.0',
    sourceUrl: 'https://github.com/openspace-ai/skill-catalog',
    sourcePath: 'skills/git-expert',
    sourceRef: 'main',
    featured: true,
  },
  {
    id: 'docker-deploy',
    name: 'Docker Deploy',
    description: 'Build, tag, and deploy Docker containers. Supports multi-stage builds, compose files, and registry push.',
    author: 'openspace-community',
    category: 'devops',
    tags: ['docker', 'containers', 'deploy', 'devops', 'ci-cd'],
    icon: '🐳',
    version: '1.0.0',
    sourceUrl: 'https://github.com/openspace-ai/skill-catalog',
    sourcePath: 'skills/docker-deploy',
    sourceRef: 'main',
    featured: false,
  },
  {
    id: 'api-docs-generator',
    name: 'API Docs Generator',
    description: 'Generate OpenAPI/Swagger documentation from code annotations. Supports TypeScript, Python, and Go.',
    author: 'openspace-community',
    category: 'documentation',
    tags: ['docs', 'openapi', 'swagger', 'api', 'documentation'],
    icon: '📝',
    version: '1.0.0',
    sourceUrl: 'https://github.com/openspace-ai/skill-catalog',
    sourcePath: 'skills/api-docs-generator',
    sourceRef: 'main',
    featured: false,
  },
  {
    id: 'dependency-audit',
    name: 'Dependency Audit',
    description: 'Scan project dependencies for known vulnerabilities, outdated packages, and license compliance issues.',
    author: 'openspace-community',
    category: 'security',
    tags: ['security', 'audit', 'dependencies', 'vulnerabilities', 'npm', 'cve'],
    icon: '🛡️',
    version: '1.0.0',
    sourceUrl: 'https://github.com/openspace-ai/skill-catalog',
    sourcePath: 'skills/dependency-audit',
    sourceRef: 'main',
    featured: true,
  },
  {
    id: 'performance-profiler',
    name: 'Performance Profiler',
    description: 'Profile application performance — CPU, memory, I/O bottlenecks. Generates flame graphs and optimization suggestions.',
    author: 'openspace-community',
    category: 'code-quality',
    tags: ['performance', 'profiling', 'optimization', 'flame-graph', 'benchmark'],
    icon: '⚡',
    version: '1.0.0',
    sourceUrl: 'https://github.com/openspace-ai/skill-catalog',
    sourcePath: 'skills/performance-profiler',
    sourceRef: 'main',
    featured: false,
  },
  {
    id: 'database-migrator',
    name: 'Database Migrator',
    description: 'Create, validate, and run database schema migrations. Supports SQLite, PostgreSQL, and MySQL.',
    author: 'openspace-community',
    category: 'data',
    tags: ['database', 'migration', 'schema', 'sql', 'postgres', 'sqlite'],
    icon: '🗄️',
    version: '1.0.0',
    sourceUrl: 'https://github.com/openspace-ai/skill-catalog',
    sourcePath: 'skills/database-migrator',
    sourceRef: 'main',
    featured: false,
  },
  {
    id: 'slack-notifier',
    name: 'Slack Notifier',
    description: 'Send notifications to Slack channels on task completion, build failures, or custom triggers.',
    author: 'openspace-community',
    category: 'communication',
    tags: ['slack', 'notifications', 'webhooks', 'alerts', 'integration'],
    icon: '💬',
    version: '1.0.0',
    sourceUrl: 'https://github.com/openspace-ai/skill-catalog',
    sourcePath: 'skills/slack-notifier',
    sourceRef: 'main',
    featured: false,
  },
  {
    id: 'prompt-engineer',
    name: 'Prompt Engineer',
    description: 'Craft, test, and optimize LLM prompts. A/B testing, token counting, and prompt template management.',
    author: 'openspace-community',
    category: 'ai-ml',
    tags: ['ai', 'llm', 'prompt', 'gpt', 'optimization', 'templates'],
    icon: '🤖',
    version: '1.0.0',
    sourceUrl: 'https://github.com/openspace-ai/skill-catalog',
    sourcePath: 'skills/prompt-engineer',
    sourceRef: 'main',
    featured: true,
  },
  {
    id: 'changelog-writer',
    name: 'Changelog Writer',
    description: 'Auto-generate changelogs from git history using conventional commits. Supports Keep a Changelog format.',
    author: 'openspace-community',
    category: 'documentation',
    tags: ['changelog', 'release', 'git', 'conventional-commits', 'semver'],
    icon: '📋',
    version: '1.0.0',
    sourceUrl: 'https://github.com/openspace-ai/skill-catalog',
    sourcePath: 'skills/changelog-writer',
    sourceRef: 'main',
    featured: false,
  },
  {
    id: 'e2e-test-generator',
    name: 'E2E Test Generator',
    description: 'Generate end-to-end tests from user stories. Supports Playwright, Cypress, and Selenium.',
    author: 'openspace-community',
    category: 'testing',
    tags: ['e2e', 'testing', 'playwright', 'cypress', 'selenium', 'automation'],
    icon: '🎭',
    version: '1.0.0',
    sourceUrl: 'https://github.com/openspace-ai/skill-catalog',
    sourcePath: 'skills/e2e-test-generator',
    sourceRef: 'main',
    featured: false,
  },
  {
    id: 'ci-pipeline-builder',
    name: 'CI Pipeline Builder',
    description: 'Generate and optimize CI/CD pipelines for GitHub Actions, Azure DevOps, and GitLab CI.',
    author: 'openspace-community',
    category: 'devops',
    tags: ['ci', 'cd', 'pipeline', 'github-actions', 'azure-devops', 'automation'],
    icon: '🔄',
    version: '1.0.0',
    sourceUrl: 'https://github.com/openspace-ai/skill-catalog',
    sourcePath: 'skills/ci-pipeline-builder',
    sourceRef: 'main',
    featured: false,
  },
  {
    id: 'task-breakdown',
    name: 'Task Breakdown',
    description: 'Decompose complex tasks into actionable subtasks with dependency graphs and effort estimates.',
    author: 'openspace-community',
    category: 'productivity',
    tags: ['planning', 'tasks', 'decomposition', 'estimation', 'project-management'],
    icon: '🧩',
    version: '1.0.0',
    sourceUrl: 'https://github.com/openspace-ai/skill-catalog',
    sourcePath: 'skills/task-breakdown',
    sourceRef: 'main',
    featured: false,
  },
  {
    id: 'web-scraper',
    name: 'Web Scraper',
    description: 'Extract structured data from web pages. Supports CSS selectors, XPath, and headless browser rendering.',
    author: 'openspace-community',
    category: 'data',
    tags: ['web', 'scraping', 'data', 'extraction', 'crawl'],
    icon: '🕸️',
    version: '1.0.0',
    sourceUrl: 'https://github.com/openspace-ai/skill-catalog',
    sourcePath: 'skills/web-scraper',
    sourceRef: 'main',
    featured: false,
  },
];

// ── Row shape from SQLite ───────────────────────────────────────────

interface GalleryRow {
  id: string;
  name: string;
  description: string;
  author: string;
  category: string;
  tags: string;
  icon: string;
  version: string;
  source_url: string;
  source_path: string;
  source_ref: string;
  install_count: number;
  featured: number;
  added_at: string;
  updated_at: string;
}

function rowToGallerySkill(row: GalleryRow, installedIds?: Set<string>): GallerySkill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    author: row.author,
    category: row.category as GalleryCategory,
    tags: JSON.parse(row.tags),
    icon: row.icon,
    version: row.version,
    sourceUrl: row.source_url,
    sourcePath: row.source_path,
    sourceRef: row.source_ref,
    installCount: row.install_count,
    featured: row.featured === 1,
    installed: installedIds?.has(row.id) ?? false,
    addedAt: row.added_at,
    updatedAt: row.updated_at,
  };
}

// ── Service ─────────────────────────────────────────────────────────

export class SkillGalleryService {
  constructor(
    private db: Database.Database,
    private getInstalledIds: () => Set<string>,
  ) {}

  /** Seed the catalog if empty. Safe to call multiple times. */
  seed(): void {
    const count = this.db
      .prepare<[], { cnt: number }>('SELECT COUNT(*) as cnt FROM skill_gallery')
      .get();

    if (count && count.cnt > 0) return;

    const now = new Date().toISOString();
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO skill_gallery
        (id, name, description, author, category, tags, icon, version,
         source_url, source_path, source_ref, install_count, featured, added_at, updated_at)
      VALUES
        (@id, @name, @description, @author, @category, @tags, @icon, @version,
         @sourceUrl, @sourcePath, @sourceRef, @installCount, @featured, @addedAt, @updatedAt)
    `);

    const tx = this.db.transaction(() => {
      for (const skill of SEED_SKILLS) {
        insert.run({
          id: skill.id,
          name: skill.name,
          description: skill.description,
          author: skill.author,
          category: skill.category,
          tags: JSON.stringify(skill.tags),
          icon: skill.icon,
          version: skill.version,
          sourceUrl: skill.sourceUrl,
          sourcePath: skill.sourcePath,
          sourceRef: skill.sourceRef,
          installCount: 0,
          featured: skill.featured ? 1 : 0,
          addedAt: now,
          updatedAt: now,
        });
      }
    });

    tx();
  }

  /** Search/browse the gallery catalog. */
  search(params: GallerySearchParams = {}): GallerySearchResult {
    const {
      query,
      category,
      tags,
      featured,
      sort = 'name',
      order = 'asc',
      limit = 50,
      offset = 0,
    } = params;

    const installedIds = this.getInstalledIds();

    // FTS search path
    if (query && query.trim().length > 0) {
      return this.ftsSearch(query.trim(), { category, tags, featured, sort, order, limit, offset }, installedIds);
    }

    // Structured filter path
    const conditions: string[] = [];
    const bindings: Record<string, unknown> = {};

    if (category) {
      conditions.push('category = @category');
      bindings.category = category;
    }
    if (featured !== undefined) {
      conditions.push('featured = @featured');
      bindings.featured = featured ? 1 : 0;
    }
    if (tags && tags.length > 0) {
      // Match any tag (OR logic via LIKE on the JSON array)
      const tagClauses = tags.map((t, i) => {
        const key = `tag${i}`;
        bindings[key] = `%"${t}"%`;
        return `tags LIKE @${key}`;
      });
      conditions.push(`(${tagClauses.join(' OR ')})`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortCol = this.resolveSortColumn(sort);
    const dir = order === 'desc' ? 'DESC' : 'ASC';

    const countSql = `SELECT COUNT(*) as cnt FROM skill_gallery ${where}`;
    const total = (this.db.prepare(countSql).get(bindings) as { cnt: number })?.cnt ?? 0;

    const dataSql = `SELECT * FROM skill_gallery ${where} ORDER BY ${sortCol} ${dir} LIMIT @limit OFFSET @offset`;
    const rows = this.db.prepare(dataSql).all({ ...bindings, limit, offset }) as GalleryRow[];

    return {
      skills: rows.map((r) => rowToGallerySkill(r, installedIds)),
      total,
      limit,
      offset,
    };
  }

  /** Get featured/curated skills. */
  featured(limit = 10): GallerySkill[] {
    const installedIds = this.getInstalledIds();
    const rows = this.db
      .prepare<{ limit: number }, GalleryRow>(
        'SELECT * FROM skill_gallery WHERE featured = 1 ORDER BY install_count DESC LIMIT @limit',
      )
      .all({ limit }) as GalleryRow[];
    return rows.map((r) => rowToGallerySkill(r, installedIds));
  }

  /** List all categories with skill counts. */
  categories(): Array<{ category: GalleryCategory; count: number; label: string }> {
    const rows = this.db
      .prepare<[], { category: string; count: number }>(
        'SELECT category, COUNT(*) as count FROM skill_gallery GROUP BY category ORDER BY count DESC',
      )
      .all();

    const labelMap: Record<string, string> = {
      'code-quality': 'Code Quality',
      'testing': 'Testing',
      'devops': 'DevOps & CI/CD',
      'documentation': 'Documentation',
      'security': 'Security',
      'productivity': 'Productivity',
      'data': 'Data & Databases',
      'communication': 'Communication',
      'ai-ml': 'AI & Machine Learning',
      'other': 'Other',
    };

    // Include all categories, even those with zero skills
    const countMap = new Map(rows.map((r) => [r.category, r.count]));
    return GALLERY_CATEGORIES.map((cat) => ({
      category: cat,
      count: countMap.get(cat) ?? 0,
      label: labelMap[cat] ?? cat,
    }));
  }

  /** Get a single gallery skill by ID. */
  get(id: string): GallerySkill | null {
    const installedIds = this.getInstalledIds();
    const row = this.db
      .prepare<{ id: string }, GalleryRow>('SELECT * FROM skill_gallery WHERE id = @id')
      .get({ id });
    return row ? rowToGallerySkill(row, installedIds) : null;
  }

  /** Increment install count for a gallery skill. */
  incrementInstallCount(id: string): void {
    this.db
      .prepare('UPDATE skill_gallery SET install_count = install_count + 1, updated_at = @now WHERE id = @id')
      .run({ id, now: new Date().toISOString() });
  }

  /** Add or update a skill in the catalog. */
  upsert(skill: Omit<GallerySkill, 'installed' | 'installCount' | 'addedAt' | 'updatedAt'>): void {
    const now = new Date().toISOString();
    this.db
      .prepare(`
        INSERT INTO skill_gallery
          (id, name, description, author, category, tags, icon, version,
           source_url, source_path, source_ref, featured, added_at, updated_at)
        VALUES
          (@id, @name, @description, @author, @category, @tags, @icon, @version,
           @sourceUrl, @sourcePath, @sourceRef, @featured, @now, @now)
        ON CONFLICT(id) DO UPDATE SET
          name = @name, description = @description, author = @author,
          category = @category, tags = @tags, icon = @icon, version = @version,
          source_url = @sourceUrl, source_path = @sourcePath, source_ref = @sourceRef,
          featured = @featured, updated_at = @now
      `)
      .run({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        author: skill.author,
        category: skill.category,
        tags: JSON.stringify(skill.tags),
        icon: skill.icon,
        version: skill.version,
        sourceUrl: skill.sourceUrl,
        sourcePath: skill.sourcePath,
        sourceRef: skill.sourceRef,
        featured: skill.featured ? 1 : 0,
        now,
      });
  }

  /** Total number of skills in the catalog. */
  count(): number {
    const row = this.db
      .prepare<[], { cnt: number }>('SELECT COUNT(*) as cnt FROM skill_gallery')
      .get();
    return row?.cnt ?? 0;
  }

  // ── Private ─────────────────────────────────────────────────────

  private ftsSearch(
    query: string,
    filters: {
      category?: GalleryCategory;
      tags?: string[];
      featured?: boolean;
      sort: string;
      order: string;
      limit: number;
      offset: number;
    },
    installedIds: Set<string>,
  ): GallerySearchResult {
    // Tokenize and create FTS match expression
    const tokens = query
      .replace(/[^\w\s-]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 0);

    if (tokens.length === 0) {
      return { skills: [], total: 0, limit: filters.limit, offset: filters.offset };
    }

    // Use OR matching for broader results, with wildcard prefix matching
    const ftsExpr = tokens.map((t) => `"${t}"*`).join(' OR ');

    const postFilters: string[] = [];
    const bindings: Record<string, unknown> = {};

    if (filters.category) {
      postFilters.push('g.category = @category');
      bindings.category = filters.category;
    }
    if (filters.featured !== undefined) {
      postFilters.push('g.featured = @featured');
      bindings.featured = filters.featured ? 1 : 0;
    }
    if (filters.tags && filters.tags.length > 0) {
      const tagClauses = filters.tags.map((t, i) => {
        const key = `tag${i}`;
        bindings[key] = `%"${t}"%`;
        return `g.tags LIKE @${key}`;
      });
      postFilters.push(`(${tagClauses.join(' OR ')})`);
    }

    const postWhere = postFilters.length > 0 ? `AND ${postFilters.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) as cnt
      FROM skill_gallery g
      JOIN skill_gallery_fts f ON g.id = f.id
      WHERE skill_gallery_fts MATCH @ftsExpr ${postWhere}
    `;
    const total = (this.db.prepare(countSql).get({ ...bindings, ftsExpr }) as { cnt: number })?.cnt ?? 0;

    const sortCol = this.resolveSortColumn(filters.sort, 'g.');
    const dir = filters.order === 'desc' ? 'DESC' : 'ASC';

    const dataSql = `
      SELECT g.*
      FROM skill_gallery g
      JOIN skill_gallery_fts f ON g.id = f.id
      WHERE skill_gallery_fts MATCH @ftsExpr ${postWhere}
      ORDER BY ${sortCol} ${dir}
      LIMIT @limit OFFSET @offset
    `;
    const rows = this.db
      .prepare(dataSql)
      .all({ ...bindings, ftsExpr, limit: filters.limit, offset: filters.offset }) as GalleryRow[];

    return {
      skills: rows.map((r) => rowToGallerySkill(r, installedIds)),
      total,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  private resolveSortColumn(sort: string, prefix = ''): string {
    const map: Record<string, string> = {
      name: `${prefix}name`,
      installCount: `${prefix}install_count`,
      addedAt: `${prefix}added_at`,
      updatedAt: `${prefix}updated_at`,
    };
    return map[sort] ?? `${prefix}name`;
  }
}
