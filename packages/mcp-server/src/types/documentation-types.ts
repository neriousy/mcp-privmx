/**
 * Type definitions for MDX Documentation System
 *
 * Comprehensive types for parsing, indexing, searching, and serving MDX documentation
 * through the MCP protocol for AI-accessible knowledge base.
 */

export interface DocumentMetadata {
  /** Document title from frontmatter */
  title: string;
  /** Optional description */
  description?: string;
  /** Programming language (js, cpp, java, etc.) */
  language?: string;
  /** Framework (react, vue, next, etc.) */
  framework?: string;
  /** Skill level (beginner, intermediate, advanced) */
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
  /** Tags for categorization */
  tags?: string[];
  /** File path relative to spec/mdx */
  filePath: string;
  /** Last modified timestamp */
  lastModified?: Date;
  /** Document category (tutorial, concept, api, etc.) */
  category?: string;
  /** Namespace (Core, Threads, Stores, Inboxes) */
  namespace?: string;
}

export interface CodeBlock {
  /** Programming language */
  language: string;
  /** Raw code content */
  code: string;
  /** Optional title or description */
  title?: string;
  /** Line numbers in original document */
  startLine: number;
  endLine: number;
  /** Whether it's a complete example */
  isComplete?: boolean;
}

export interface ProcessedContent {
  /** Clean markdown content without frontmatter */
  markdown: string;
  /** Extracted code blocks */
  codeBlocks: CodeBlock[];
  /** Internal links to other documents */
  internalLinks: string[];
  /** External links */
  externalLinks: string[];
  /** Key concepts mentioned */
  concepts: string[];
  /** API methods referenced */
  apiReferences: string[];
}

export interface ParsedMDXDocument {
  /** Unique document ID */
  id: string;
  /** Document metadata */
  metadata: DocumentMetadata;
  /** Processed content */
  content: ProcessedContent;
  /** Raw frontmatter */
  frontmatter: Record<string, any>;
  /** Raw markdown content */
  rawContent: string;
  /** Document hash for change detection */
  contentHash: string;
}

export interface DocumentationSearchFilters {
  /** Filter by programming language */
  language?: string;
  /** Filter by framework */
  framework?: string;
  /** Filter by skill level */
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
  /** Filter by category */
  category?: string;
  /** Filter by namespace */
  namespace?: string;
  /** Filter by tags */
  tags?: string[];
  /** Include code examples only */
  hasCodeExamples?: boolean;
}

export interface DocumentationResult {
  /** Document ID */
  id: string;
  /** Document title */
  title: string;
  /** AI-friendly summary */
  summary: string;
  /** Full content excerpt */
  content: string;
  /** Document metadata */
  metadata: DocumentMetadata;
  /** Relevant code examples */
  codeExamples: CodeExample[];
  /** Related API references */
  relatedAPIs: string[];
  /** Related documents */
  relatedDocs: RelatedDocument[];
  /** Relevance score */
  score: number;
  /** AI-optimized insights */
  aiInsights: AIInsights;
}

export interface CodeExample {
  /** Programming language */
  language: string;
  /** Code snippet */
  code: string;
  /** Title or description */
  title?: string;
  /** Complexity level */
  complexity: 'simple' | 'intermediate' | 'advanced';
  /** Whether it's runnable */
  isRunnable: boolean;
  /** Prerequisites */
  prerequisites?: string[];
  /** Source document */
  sourceDocument: string;
}

export interface RelatedDocument {
  /** Document ID */
  id: string;
  /** Document title */
  title: string;
  /** Relationship type */
  relationshipType: 'similar' | 'prerequisite' | 'next-step' | 'related-api';
  /** Relationship score */
  score: number;
}

export interface AIInsights {
  /** Key takeaways from the document */
  keyTakeaways: string[];
  /** Common pitfalls mentioned */
  commonPitfalls: string[];
  /** Best practices highlighted */
  bestPractices: string[];
  /** Prerequisites for understanding */
  prerequisites: string[];
  /** Suggested next steps */
  nextSteps: string[];
}

export interface ConceptualResult {
  /** Concept name */
  concept: string;
  /** Concept explanation */
  explanation: string;
  /** Related documents */
  documents: DocumentationResult[];
  /** Code examples for this concept */
  examples: CodeExample[];
}

export interface TutorialResult {
  /** Tutorial title */
  title: string;
  /** Tutorial description */
  description: string;
  /** Skill level */
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  /** Estimated completion time */
  estimatedTime?: string;
  /** Tutorial steps */
  steps: TutorialStep[];
  /** Final code result */
  finalCode?: CodeExample;
}

export interface TutorialStep {
  /** Step number */
  stepNumber: number;
  /** Step title */
  title: string;
  /** Step description */
  description: string;
  /** Code for this step */
  code?: CodeExample;
  /** Related documentation */
  relatedDocs?: string[];
}

export interface LearningPath {
  /** Path title */
  title: string;
  /** Path description */
  description: string;
  /** Estimated total time */
  estimatedTime: string;
  /** Learning steps */
  steps: LearningStep[];
  /** Prerequisites */
  prerequisites: string[];
  /** Final goals */
  goals: string[];
}

export interface LearningStep {
  /** Step number */
  stepNumber: number;
  /** Step title */
  title: string;
  /** Step description */
  description: string;
  /** Documents to read */
  documents: string[];
  /** Exercises or examples */
  exercises?: CodeExample[];
  /** Completion criteria */
  completionCriteria: string[];
}

export interface NextStep {
  /** Step title */
  title: string;
  /** Step description */
  description: string;
  /** Recommended documents */
  documents: string[];
  /** Difficulty increase */
  difficultyIncrease: 'none' | 'slight' | 'moderate' | 'significant';
  /** Estimated time */
  estimatedTime?: string;
}

export interface KnowledgeGap {
  /** Gap title */
  title: string;
  /** Gap description */
  description: string;
  /** Missing concepts */
  missingConcepts: string[];
  /** Recommended learning resources */
  recommendedResources: DocumentationResult[];
  /** Priority level */
  priority: 'low' | 'medium' | 'high';
}

export interface AdaptedContent {
  /** Adapted content */
  content: string;
  /** Adaptation notes */
  adaptationNotes: string[];
  /** Complexity adjustments made */
  adjustments: string[];
  /** Additional resources for this level */
  additionalResources?: DocumentationResult[];
}

export interface IndexResult {
  /** Number of documents indexed */
  documentsIndexed: number;
  /** Number of code examples extracted */
  codeExamplesExtracted: number;
  /** Indexing time in milliseconds */
  indexingTime: number;
  /** Any errors encountered */
  errors: string[];
  /** Success status */
  success: boolean;
}

export interface SearchContext {
  /** User's preferred language */
  preferredLanguage?: string;
  /** User's skill level */
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
  /** Current project context */
  projectContext?: string;
  /** Previously viewed documents */
  viewedDocuments?: string[];
}

// Search engine interfaces
export interface DocumentIndex {
  /** Document content vector embeddings */
  contentEmbeddings: Map<string, number[]>;
  /** Code block embeddings */
  codeEmbeddings: Map<string, number[]>;
  /** Metadata index */
  metadataIndex: Map<string, DocumentMetadata>;
  /** Full-text search index */
  textIndex: Map<string, string[]>;
  /** Concept index */
  conceptIndex: Map<string, string[]>;
}

export interface SearchQuery {
  /** Search query text */
  query: string;
  /** Search filters */
  filters?: DocumentationSearchFilters;
  /** Search context */
  context?: SearchContext;
  /** Maximum results */
  limit?: number;
  /** Minimum relevance score */
  minScore?: number;
}

export interface DocumentationStats {
  /** Total documents indexed */
  totalDocuments: number;
  /** Documents by language */
  documentsByLanguage: Record<string, number>;
  /** Documents by category */
  documentsByCategory: Record<string, number>;
  /** Total code examples */
  totalCodeExamples: number;
  /** Average processing time */
  averageProcessingTime: number;
  /** Last index update */
  lastIndexUpdate: Date;
}

export interface VectorSearchResult {
  /** Document ID */
  documentId: string;
  /** Document title */
  title: string;
  /** Content that matched */
  content: string;
  /** Document metadata */
  metadata: Record<string, any>;
  /** Similarity score (0-1) */
  score: number;
  /** Result type */
  type: 'document' | 'code';
}
