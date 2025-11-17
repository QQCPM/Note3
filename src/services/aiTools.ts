import { invoke } from '@tauri-apps/api/core';

/**
 * AI Tool Definition
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: any;
}

/**
 * AI Tool Result
 */
export interface ToolResult {
  success: boolean;
  data: any;
  error?: string;
}

/**
 * AI Tools Service - Phase 1 & 2
 * Provides AI with deep understanding of databases and artifacts
 */
class AIToolsService {
  /**
   * Get all available tools (database + artifact)
   */
  async getAllTools(): Promise<ToolDefinition[]> {
    return await invoke<ToolDefinition[]>('ai_get_tools');
  }

  /**
   * Get database-specific tools (10 tools)
   */
  async getDatabaseTools(): Promise<ToolDefinition[]> {
    return await invoke<ToolDefinition[]>('ai_get_database_tools');
  }

  /**
   * Get artifact-specific tools (10 tools)
   */
  async getArtifactTools(): Promise<ToolDefinition[]> {
    return await invoke<ToolDefinition[]>('ai_get_artifact_tools');
  }

  // ========================================================================
  // DATABASE TOOLS
  // ========================================================================

  /**
   * Query database rows with filters
   */
  async dbQueryRows(
    blockId: string,
    filter?: Record<string, any>,
    limit?: number
  ): Promise<ToolResult> {
    return await invoke<ToolResult>('ai_execute_database_tool', {
      toolName: 'db_query_rows',
      params: { block_id: blockId, filter, limit },
    });
  }

  /**
   * Aggregate database column (sum, avg, count, min, max)
   */
  async dbAggregate(
    blockId: string,
    operation: 'sum' | 'avg' | 'count' | 'min' | 'max',
    column: string,
    filter?: Record<string, any>
  ): Promise<ToolResult> {
    return await invoke<ToolResult>('ai_execute_database_tool', {
      toolName: 'db_aggregate',
      params: { block_id: blockId, operation, column, filter },
    });
  }

  /**
   * Group database rows and aggregate
   */
  async dbGroupBy(
    blockId: string,
    groupBy: string[],
    aggregations: Array<{
      operation: string;
      column: string;
      alias?: string;
    }>
  ): Promise<ToolResult> {
    return await invoke<ToolResult>('ai_execute_database_tool', {
      toolName: 'db_group_by',
      params: { block_id: blockId, group_by: groupBy, aggregations },
    });
  }

  /**
   * Get statistical analysis of a column
   */
  async dbColumnStats(blockId: string, column: string): Promise<ToolResult> {
    return await invoke<ToolResult>('ai_execute_database_tool', {
      toolName: 'db_column_stats',
      params: { block_id: blockId, column },
    });
  }

  /**
   * Create chart-ready data from database
   */
  async dbCreateChartData(
    blockId: string,
    chartType: 'pie' | 'bar' | 'line' | 'scatter',
    xColumn: string,
    yColumn: string,
    groupBy?: string
  ): Promise<ToolResult> {
    return await invoke<ToolResult>('ai_execute_database_tool', {
      toolName: 'db_create_chart_data',
      params: {
        block_id: blockId,
        chart_type: chartType,
        x_column: xColumn,
        y_column: yColumn,
        group_by: groupBy,
      },
    });
  }

  /**
   * Sort database rows
   */
  async dbSortRows(
    blockId: string,
    sortBy: Array<{ column: string; direction: 'asc' | 'desc' }>,
    limit?: number
  ): Promise<ToolResult> {
    return await invoke<ToolResult>('ai_execute_database_tool', {
      toolName: 'db_sort_rows',
      params: { block_id: blockId, sort_by: sortBy, limit },
    });
  }

  /**
   * Get detailed database schema
   */
  async dbGetSchema(blockId: string): Promise<ToolResult> {
    return await invoke<ToolResult>('ai_execute_database_tool', {
      toolName: 'db_get_schema',
      params: { block_id: blockId },
    });
  }

  /**
   * Update database rows
   */
  async dbUpdateRows(
    blockId: string,
    filter: Record<string, any>,
    updates: Record<string, any>
  ): Promise<ToolResult> {
    return await invoke<ToolResult>('ai_execute_database_tool', {
      toolName: 'db_update_rows',
      params: { block_id: blockId, filter, updates },
    });
  }

  /**
   * Add a row to database
   */
  async dbAddRow(
    blockId: string,
    rowData: Record<string, any>
  ): Promise<ToolResult> {
    return await invoke<ToolResult>('ai_execute_database_tool', {
      toolName: 'db_add_row',
      params: { block_id: blockId, row_data: rowData },
    });
  }

  /**
   * Delete database rows
   */
  async dbDeleteRows(
    blockId: string,
    filter: Record<string, any>
  ): Promise<ToolResult> {
    return await invoke<ToolResult>('ai_execute_database_tool', {
      toolName: 'db_delete_rows',
      params: { block_id: blockId, filter },
    });
  }

  // ========================================================================
  // ARTIFACT TOOLS
  // ========================================================================

  /**
   * Parse artifact HTML structure
   */
  async artifactParseStructure(blockId: string): Promise<ToolResult> {
    return await invoke<ToolResult>('ai_execute_artifact_tool', {
      toolName: 'artifact_parse_structure',
      params: { block_id: blockId },
    });
  }

  /**
   * Get CSS rules from artifact
   */
  async artifactGetCssRules(
    blockId: string,
    selector?: string
  ): Promise<ToolResult> {
    return await invoke<ToolResult>('ai_execute_artifact_tool', {
      toolName: 'artifact_get_css_rules',
      params: { block_id: blockId, selector },
    });
  }

  /**
   * Get JavaScript functions from artifact
   */
  async artifactGetJsFunctions(blockId: string): Promise<ToolResult> {
    return await invoke<ToolResult>('ai_execute_artifact_tool', {
      toolName: 'artifact_get_js_functions',
      params: { block_id: blockId },
    });
  }

  /**
   * Modify artifact HTML
   */
  async artifactModifyHtml(
    blockId: string,
    selector: string,
    operation: string,
    content?: string
  ): Promise<ToolResult> {
    return await invoke<ToolResult>('ai_execute_artifact_tool', {
      toolName: 'artifact_modify_html',
      params: { block_id: blockId, selector, operation, content },
    });
  }

  /**
   * Modify artifact CSS
   */
  async artifactModifyCss(
    blockId: string,
    selector: string,
    operation: 'add' | 'update' | 'delete',
    properties?: Record<string, string>
  ): Promise<ToolResult> {
    return await invoke<ToolResult>('ai_execute_artifact_tool', {
      toolName: 'artifact_modify_css',
      params: { block_id: blockId, selector, operation, properties },
    });
  }

  /**
   * Modify artifact JavaScript
   */
  async artifactModifyJs(
    blockId: string,
    operation: string,
    code: string,
    target?: string
  ): Promise<ToolResult> {
    return await invoke<ToolResult>('ai_execute_artifact_tool', {
      toolName: 'artifact_modify_js',
      params: { block_id: blockId, operation, code, target },
    });
  }

  /**
   * Validate artifact code
   */
  async artifactValidate(blockId: string): Promise<ToolResult> {
    return await invoke<ToolResult>('ai_execute_artifact_tool', {
      toolName: 'artifact_validate',
      params: { block_id: blockId },
    });
  }

  /**
   * Extract dependencies from artifact
   */
  async artifactExtractDependencies(blockId: string): Promise<ToolResult> {
    return await invoke<ToolResult>('ai_execute_artifact_tool', {
      toolName: 'artifact_extract_dependencies',
      params: { block_id: blockId },
    });
  }

  /**
   * Optimize artifact
   */
  async artifactOptimize(
    blockId: string,
    optimizationType: 'size' | 'performance' | 'accessibility' | 'best_practices'
  ): Promise<ToolResult> {
    return await invoke<ToolResult>('ai_execute_artifact_tool', {
      toolName: 'artifact_optimize',
      params: { block_id: blockId, optimization_type: optimizationType },
    });
  }

  /**
   * Get colors used in artifact
   */
  async artifactGetColors(blockId: string): Promise<ToolResult> {
    return await invoke<ToolResult>('ai_execute_artifact_tool', {
      toolName: 'artifact_get_colors',
      params: { block_id: blockId },
    });
  }

  // ========================================================================
  // ENHANCED AI CHAT
  // ========================================================================

  /**
   * Chat with AI using automatic tool calling
   * The AI will automatically use database and artifact tools as needed
   */
  async chatWithAutoTools(
    messages: Array<{ role: string; content: string }>,
    noteId?: string
  ): Promise<string> {
    return await invoke<string>('ai_chat_with_auto_tools', {
      messages,
      noteId: noteId || null,
    });
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  /**
   * Execute any tool by name with custom parameters
   */
  async executeTool(
    toolName: string,
    params: any
  ): Promise<ToolResult> {
    if (toolName.startsWith('db_')) {
      return await invoke<ToolResult>('ai_execute_database_tool', {
        toolName,
        params,
      });
    } else if (toolName.startsWith('artifact_')) {
      return await invoke<ToolResult>('ai_execute_artifact_tool', {
        toolName,
        params,
      });
    } else {
      throw new Error(`Unknown tool type: ${toolName}`);
    }
  }

  /**
   * Get tool documentation as markdown
   */
  async getToolDocumentation(): Promise<string> {
    const tools = await this.getAllTools();

    let markdown = '# AI Tools Reference\n\n';
    markdown += `**Total Tools**: ${tools.length}\n\n`;

    markdown += '## Database Tools (10)\n\n';
    const dbTools = tools.filter(t => t.name.startsWith('db_'));
    for (const tool of dbTools) {
      markdown += `### ${tool.name}\n\n`;
      markdown += `${tool.description}\n\n`;
      markdown += '```json\n';
      markdown += JSON.stringify(tool.parameters, null, 2);
      markdown += '\n```\n\n';
    }

    markdown += '## Artifact Tools (10)\n\n';
    const artifactTools = tools.filter(t => t.name.startsWith('artifact_'));
    for (const tool of artifactTools) {
      markdown += `### ${tool.name}\n\n`;
      markdown += `${tool.description}\n\n`;
      markdown += '```json\n';
      markdown += JSON.stringify(tool.parameters, null, 2);
      markdown += '\n```\n\n';
    }

    return markdown;
  }
}

export const aiToolsService = new AIToolsService();
