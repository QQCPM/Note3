import { invoke } from '@tauri-apps/api/core';

/**
 * Agentic AI Types - Phase 4
 */

export interface DataSchema {
  columns: ColumnSpec[];
  constraints: Constraint[];
}

export interface ColumnSpec {
  name: string;
  data_type: string;
  description: string;
  example?: string;
}

export interface Constraint {
  type: ConstraintType;
  description: string;
}

export type ConstraintType =
  | { type: 'Required' }
  | { type: 'Unique' }
  | { type: 'Range'; min: number; max: number }
  | { type: 'Pattern'; regex: string };

export interface AgentStep {
  id: string;
  step_type: AgentStepType;
  depends_on: string[];
  status: StepStatus;
  result?: StepResult;
  error?: string;
  retry_count: number;
}

export type AgentStepType =
  | { type: 'Research'; query: string; purpose: string }
  | { type: 'ExtractData'; query: string; schema: DataSchema; count: number }
  | { type: 'CreateNote'; title: string; parent_id?: string }
  | { type: 'CreateDatabase'; title: string; columns: DatabaseColumn[] }
  | { type: 'CreateArtifact'; title: string; artifact_type: string; content_prompt: string }
  | { type: 'GenerateContent'; block_id: string; content_type: string; prompt: string }
  | { type: 'PopulateDatabase'; database_id: string; data_source: DataSource }
  | { type: 'Validate'; target: string; criteria: string[] }
  | { type: 'Reflect'; on: string; improve: boolean };

export interface DatabaseColumn {
  name: string;
  type: string;
  options?: string[];
}

export type DataSource =
  | { type: 'Research'; data: Record<string, any>[] }
  | { type: 'AIGenerated'; prompt: string }
  | { type: 'Transformed'; source_database_id: string; transformation: string };

export type StepStatus = 'Pending' | 'InProgress' | 'Completed' | 'Failed' | 'Skipped';

export interface StepResult {
  success: boolean;
  data?: any;
  message: string;
}

export interface ResearchResult {
  query: string;
  sources: Source[];
  summary: string;
  data?: Record<string, any>[];
}

export interface Source {
  title: string;
  url: string;
  snippet: string;
}

export interface AgenticResult {
  task_id: string;
  status: AgenticStatus;
  created_blocks: BlockInfo[];
  execution_time_ms: number;
  steps_completed: number;
  steps_failed: number;
  error?: string;
}

export interface BlockInfo {
  id: string;
  block_type: string;
  title: string;
  step_id: string;
}

export type AgenticStatus =
  | 'Planning'
  | 'Researching'
  | 'Extracting'
  | 'Creating'
  | 'Populating'
  | 'Validating'
  | 'Completed'
  | 'Failed';

export interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
  score: number;
}

export interface ValidationIssue {
  severity: IssueSeverity;
  description: string;
  suggestion?: string;
}

export type IssueSeverity = 'Error' | 'Warning' | 'Info';

/**
 * Agentic AI Service - Phase 4
 * Autonomous AI that can research, plan, and execute complex tasks
 */
class AgenticAIService {
  /**
   * Execute an autonomous task
   * The AI will plan, research, create blocks, and populate data automatically
   *
   * Example:
   * ```ts
   * const result = await agenticAI.executeTask(
   *   "Create a table of top 5 largest black holes",
   *   noteId
   * );
   * ```
   */
  async executeTask(task: string, noteId?: string): Promise<AgenticResult> {
    return await invoke<AgenticResult>('agentic_execute_task', {
      task,
      noteId: noteId || null,
    });
  }

  /**
   * Plan a task without executing (for preview)
   * Shows what steps the AI would take
   */
  async planTask(task: string): Promise<AgentStep[]> {
    return await invoke<AgentStep[]>('agentic_plan_task', {
      task,
    });
  }

  /**
   * Research a topic and get a summary
   */
  async research(query: string): Promise<ResearchResult> {
    return await invoke<ResearchResult>('agentic_research', {
      query,
    });
  }

  /**
   * Research and extract structured data
   *
   * Example:
   * ```ts
   * const data = await agenticAI.researchAndExtract(
   *   "largest black holes",
   *   {
   *     columns: [
   *       { name: "Name", data_type: "string", description: "Black hole name" },
   *       { name: "Mass", data_type: "number", description: "Mass in solar masses" },
   *       { name: "Distance", data_type: "number", description: "Distance in light years" }
   *     ],
   *     constraints: []
   *   },
   *   5
   * );
   * ```
   */
  async researchAndExtract(
    query: string,
    schema: DataSchema,
    count: number
  ): Promise<Record<string, any>[]> {
    return await invoke<Record<string, any>[]>('agentic_research_and_extract', {
      query,
      schema,
      count,
    });
  }

  /**
   * Verify data accuracy
   */
  async verifyData(data: Record<string, any>[]): Promise<ValidationResult> {
    return await invoke<ValidationResult>('agentic_verify_data', {
      data,
    });
  }

  // ========================================================================
  // HELPER METHODS - Common agentic patterns
  // ========================================================================

  /**
   * Create a research table
   * AI researches topic, creates database, and populates with data
   *
   * Example:
   * ```ts
   * await agenticAI.createResearchTable(
   *   "top 5 largest black holes",
   *   ["Name", "Mass (solar masses)", "Distance (ly)", "Location"],
   *   5,
   *   noteId
   * );
   * ```
   */
  async createResearchTable(
    topic: string,
    columnNames: string[],
    rowCount: number,
    noteId?: string
  ): Promise<AgenticResult> {
    const task = `Research ${topic} and create a table with ${rowCount} rows. \
                  Columns: ${columnNames.join(', ')}. \
                  Fill the table with accurate, researched data.`;

    return this.executeTask(task, noteId);
  }

  /**
   * Create a comprehensive research note
   * AI creates note with text, tables, and visualizations
   *
   * Example:
   * ```ts
   * await agenticAI.createResearchNote(
   *   "Black Holes",
   *   [
   *     "Explain what black holes are",
   *     "Create table of top 5 largest black holes",
   *     "Create simulation artifact",
   *     "Create table of top 5 farthest black holes"
   *   ],
   *   noteId
   * );
   * ```
   */
  async createResearchNote(
    topic: string,
    requirements: string[],
    noteId?: string
  ): Promise<AgenticResult> {
    const task = `Create a comprehensive note about ${topic}. \
                  Include: ${requirements.map((r, i) => `${i + 1}. ${r}`).join('; ')}.`;

    return this.executeTask(task, noteId);
  }

  /**
   * Format agentic result for display
   */
  formatResult(result: AgenticResult): string {
    if (result.status === 'Failed') {
      return `Task failed: ${result.error || 'Unknown error'}`;
    }

    if (result.status === 'Completed') {
      return `Task completed successfully!\n` +
        `Created ${result.created_blocks.length} blocks in ${result.execution_time_ms}ms\n` +
        `Steps: ${result.steps_completed} completed, ${result.steps_failed} failed`;
    }

    return `Task status: ${result.status}`;
  }

  /**
   * Format plan for display
   */
  formatPlan(steps: AgentStep[]): string {
    return steps
      .map((step, idx) => {
        const type = this.getStepTypeName(step.step_type);
        const deps = step.depends_on.length > 0
          ? ` (depends on: ${step.depends_on.join(', ')})`
          : '';
        return `${idx + 1}. [${step.id}] ${type}${deps}`;
      })
      .join('\n');
  }

  private getStepTypeName(stepType: AgentStepType): string {
    if ('type' in stepType) {
      return stepType.type;
    }
    return 'Unknown';
  }
}

export const agenticAI = new AgenticAIService();
