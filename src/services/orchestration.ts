import { invoke } from '@tauri-apps/api/core';

/**
 * Workflow Template
 */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];
  icon: string;
  steps: TemplateStep[];
  data_mappings: DataMapping[];
  parameters: TemplateParameter[];
}

export interface TemplateStep {
  id: string;
  step_type: StepType;
  config: any;
  depends_on: string[];
}

export interface DataMapping {
  from_step: string;
  from_field: string;
  to_step: string;
  to_field: string;
  transform?: Transformation;
}

export interface TemplateParameter {
  name: string;
  param_type: ParameterType;
  description: string;
  default?: any;
  required: boolean;
}

export type StepType =
  | { type: 'CreateNote' }
  | { type: 'CreateDatabase' }
  | { type: 'CreateArtifact' }
  | { type: 'DataTransform' }
  | { type: 'Validate' }
  | { type: 'AIGenerate' }
  | { type: 'Custom'; data: string };

export type ParameterType = 'String' | 'Number' | 'Boolean' | 'Array' | 'Object';

export type Transformation =
  | { type: 'AITransform'; config: { prompt: string } }
  | { type: 'Aggregate'; config: { operation: string; column: string } }
  | { type: 'Filter'; config: { expression: string } }
  | { type: 'Map'; config: { mapping: Record<string, string> } }
  | { type: 'GroupBy'; config: { columns: string[]; aggregations: any[] } };

/**
 * Workflow Result
 */
export interface WorkflowResult {
  workflow_id: string;
  state: WorkflowState;
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

export type WorkflowState =
  | 'Planning'
  | 'Executing'
  | 'DataFlow'
  | 'Validating'
  | 'Completed'
  | { Failed: string }
  | 'Paused'
  | 'Cancelled';

/**
 * Orchestration Service - Phase 3
 * Multi-block workflow orchestration
 */
class OrchestrationService {
  /**
   * Get all available workflow templates
   */
  async getTemplates(): Promise<WorkflowTemplate[]> {
    return await invoke<WorkflowTemplate[]>('get_workflow_templates');
  }

  /**
   * Get a specific template by ID
   */
  async getTemplate(templateId: string): Promise<WorkflowTemplate> {
    return await invoke<WorkflowTemplate>('get_workflow_template', {
      templateId,
    });
  }

  /**
   * Orchestrate a workflow from a template or prompt
   */
  async orchestrateWorkflow(options: {
    prompt?: string;
    templateId?: string;
    parameters?: Record<string, any>;
    noteId?: string;
  }): Promise<WorkflowResult> {
    return await invoke<WorkflowResult>('orchestrate_workflow', {
      prompt: options.prompt || null,
      templateId: options.templateId || null,
      parameters: options.parameters || null,
      noteId: options.noteId || null,
    });
  }

  /**
   * Create a custom workflow using AI planning
   */
  async createCustomWorkflow(
    prompt: string,
    noteId?: string
  ): Promise<WorkflowResult> {
    return await invoke<WorkflowResult>('create_custom_workflow', {
      prompt,
      noteId: noteId || null,
    });
  }

  /**
   * Cancel a running workflow
   */
  async cancelWorkflow(workflowId: string): Promise<void> {
    return await invoke<void>('cancel_workflow', { workflowId });
  }

  /**
   * Get workflow execution status
   */
  async getWorkflowStatus(workflowId: string): Promise<WorkflowState> {
    return await invoke<WorkflowState>('get_workflow_status', { workflowId });
  }

  // ========================================================================
  // HELPER METHODS - Common workflow patterns
  // ========================================================================

  /**
   * Create an expense tracker
   */
  async createExpenseTracker(
    title: string = 'Expense Tracker',
    noteId?: string
  ): Promise<WorkflowResult> {
    return this.orchestrateWorkflow({
      templateId: 'expense_tracker',
      parameters: { title },
      noteId,
    });
  }

  /**
   * Create a todo list
   */
  async createTodoList(
    title: string = 'Todo List',
    noteId?: string
  ): Promise<WorkflowResult> {
    return this.orchestrateWorkflow({
      templateId: 'todo_list',
      parameters: { title },
      noteId,
    });
  }

  /**
   * Create a project dashboard
   */
  async createProjectDashboard(
    title: string = 'Project Dashboard',
    noteId?: string
  ): Promise<WorkflowResult> {
    return this.orchestrateWorkflow({
      templateId: 'project_dashboard',
      parameters: { title },
      noteId,
    });
  }

  /**
   * Create meeting notes
   */
  async createMeetingNotes(
    meetingTitle: string = 'Meeting Notes',
    noteId?: string
  ): Promise<WorkflowResult> {
    return this.orchestrateWorkflow({
      templateId: 'meeting_notes',
      parameters: { meeting_title: meetingTitle },
      noteId,
    });
  }

  /**
   * Create a habit tracker
   */
  async createHabitTracker(
    title: string = 'Habit Tracker',
    noteId?: string
  ): Promise<WorkflowResult> {
    return this.orchestrateWorkflow({
      templateId: 'habit_tracker',
      parameters: { title },
      noteId,
    });
  }

  /**
   * Check if a prompt matches a template
   */
  async matchTemplateFromPrompt(prompt: string): Promise<WorkflowTemplate | null> {
    const templates = await this.getTemplates();
    const promptLower = prompt.toLowerCase();

    for (const template of templates) {
      // Check if any tag matches
      if (template.tags.some(tag => promptLower.includes(tag.toLowerCase()))) {
        return template;
      }

      // Check if template name matches
      if (promptLower.includes(template.name.toLowerCase())) {
        return template;
      }
    }

    return null;
  }

  /**
   * Get template suggestions based on prompt
   */
  async suggestTemplates(prompt: string): Promise<WorkflowTemplate[]> {
    const templates = await this.getTemplates();
    const promptLower = prompt.toLowerCase();
    const suggestions: Array<{ template: WorkflowTemplate; score: number }> = [];

    for (const template of templates) {
      let score = 0;

      // Score based on tag matches
      for (const tag of template.tags) {
        if (promptLower.includes(tag.toLowerCase())) {
          score += 10;
        }
      }

      // Score based on name match
      if (promptLower.includes(template.name.toLowerCase())) {
        score += 20;
      }

      if (score > 0) {
        suggestions.push({ template, score });
      }
    }

    // Sort by score descending
    suggestions.sort((a, b) => b.score - a.score);

    return suggestions.map(s => s.template);
  }

  /**
   * Get template by tags
   */
  async getTemplatesByTags(tags: string[]): Promise<WorkflowTemplate[]> {
    const templates = await this.getTemplates();
    const tagsLower = tags.map(t => t.toLowerCase());

    return templates.filter(template =>
      template.tags.some(tag => tagsLower.includes(tag.toLowerCase()))
    );
  }

  /**
   * Format workflow result for display
   */
  formatResult(result: WorkflowResult): string {
    if (typeof result.state === 'object' && 'Failed' in result.state) {
      return `Workflow failed: ${result.state.Failed}`;
    }

    if (result.state === 'Completed') {
      return `Workflow completed successfully!\n` +
        `Created ${result.created_blocks.length} blocks in ${result.execution_time_ms}ms\n` +
        `Steps: ${result.steps_completed} completed, ${result.steps_failed} failed`;
    }

    return `Workflow state: ${result.state}`;
  }
}

export const orchestrationService = new OrchestrationService();
