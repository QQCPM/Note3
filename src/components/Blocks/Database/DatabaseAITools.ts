import type { DatabaseBlockData, DatabaseColumn, DatabaseRowData } from '@/types';
import {
  calculateColumnStats,
  getValueDistribution,
  getDateRange,
  exportForAI,
} from './DatabaseUtils';

// ========================================
// AI TOOL DEFINITIONS
// These tools can be called by AI to analyze and manipulate database data
// ========================================

export interface AIToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * AI Tool: Analyze entire database
 * Returns comprehensive statistics and insights
 */
export const ANALYZE_DATABASE_TOOL: AIToolDefinition = {
  name: 'analyze_database',
  description: 'Analyze the database and return comprehensive statistics, patterns, and insights about all columns and rows',
  parameters: {
    type: 'object',
    properties: {
      include_patterns: {
        type: 'boolean',
        description: 'Whether to include pattern detection analysis',
      },
      include_recommendations: {
        type: 'boolean',
        description: 'Whether to include recommendations for data improvements',
      },
    },
  },
};

/**
 * AI Tool: Query database with natural language
 * Executes queries based on natural language input
 */
export const QUERY_DATABASE_TOOL: AIToolDefinition = {
  name: 'query_database',
  description: 'Query the database using natural language. Can filter, search, aggregate, and analyze data based on user questions.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The natural language query (e.g., "show all rows where status is active", "what is the average price?")',
      },
      return_format: {
        type: 'string',
        enum: ['rows', 'summary', 'count', 'statistics'],
        description: 'Format of the result to return',
      },
    },
    required: ['query'],
  },
};

/**
 * AI Tool: Detect patterns and anomalies
 */
export const DETECT_PATTERNS_TOOL: AIToolDefinition = {
  name: 'detect_patterns',
  description: 'Detect patterns, trends, and anomalies in the database data',
  parameters: {
    type: 'object',
    properties: {
      column_name: {
        type: 'string',
        description: 'Specific column to analyze (optional, analyzes all if not provided)',
      },
      pattern_type: {
        type: 'string',
        enum: ['trends', 'anomalies', 'duplicates', 'missing_values', 'correlations'],
        description: 'Type of pattern to detect',
      },
    },
  },
};

/**
 * AI Tool: Suggest new columns
 */
export const SUGGEST_COLUMNS_TOOL: AIToolDefinition = {
  name: 'suggest_columns',
  description: 'Suggest new columns to add based on existing data patterns and common database structures',
  parameters: {
    type: 'object',
    properties: {
      context: {
        type: 'string',
        description: 'Additional context about what the database is used for',
      },
    },
  },
};

/**
 * AI Tool: Generate insights
 */
export const GENERATE_INSIGHTS_TOOL: AIToolDefinition = {
  name: 'generate_insights',
  description: 'Generate human-readable insights and summaries about the database data',
  parameters: {
    type: 'object',
    properties: {
      focus_area: {
        type: 'string',
        enum: ['overview', 'trends', 'quality', 'completeness', 'recommendations'],
        description: 'Area to focus the insights on',
      },
    },
  },
};

// ========================================
// AI TOOL IMPLEMENTATIONS
// ========================================

export interface AnalysisResult {
  summary: string;
  statistics: Record<string, any>;
  patterns?: PatternDetectionResult[];
  recommendations?: string[];
  insights?: string[];
}

export interface QueryResult {
  rows?: DatabaseRowData[];
  summary?: string;
  count?: number;
  statistics?: any;
  explanation: string;
}

export interface PatternDetectionResult {
  type: 'trend' | 'anomaly' | 'duplicate' | 'missing' | 'correlation';
  column?: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  affected_rows?: number;
  details?: any;
}

/**
 * Analyze database and return comprehensive insights
 */
export function analyzeDatabase(
  dbData: DatabaseBlockData,
  options: { include_patterns?: boolean; include_recommendations?: boolean } = {}
): AnalysisResult {
  const { schema, statistics } = exportForAI(dbData);

  // Generate summary
  const summary = `Database "${schema.title}" contains ${dbData.rows.length} rows and ${dbData.columns.length} columns.`;

  const result: AnalysisResult = {
    summary,
    statistics,
  };

  // Pattern detection
  if (options.include_patterns) {
    result.patterns = detectAllPatterns(dbData);
  }

  // Recommendations
  if (options.include_recommendations) {
    result.recommendations = generateRecommendations(dbData, statistics);
  }

  // Generate insights
  result.insights = generateInsights(dbData, statistics);

  return result;
}

/**
 * Execute natural language query on database
 */
export function queryDatabase(
  dbData: DatabaseBlockData,
  query: string,
  _returnFormat: 'rows' | 'summary' | 'count' | 'statistics' = 'rows'
): QueryResult {
  const lowerQuery = query.toLowerCase();

  // Parse query intent
  const intent = parseQueryIntent(lowerQuery);

  let result: QueryResult = {
    explanation: `Interpreting query: "${query}"`,
  };

  // Filter operations
  if (intent.type === 'filter') {
    const filteredRows = executeFilter(dbData, intent);
    result.rows = filteredRows;
    result.count = filteredRows.length;
    result.explanation = `Found ${filteredRows.length} rows matching criteria`;
  }

  // Aggregation operations
  else if (intent.type === 'aggregate') {
    const stats = executeAggregation(dbData, intent);
    result.statistics = stats;
    result.summary = formatAggregationResult(stats, intent);
    result.explanation = `Calculated ${intent.operation} for ${intent.column}`;
  }

  // Search operations
  else if (intent.type === 'search') {
    const searchResults = executeSearch(dbData, intent);
    result.rows = searchResults;
    result.count = searchResults.length;
    result.explanation = `Found ${searchResults.length} rows containing "${intent.searchTerm}"`;
  }

  // Count operations
  else if (intent.type === 'count') {
    const count = dbData.rows.length;
    result.count = count;
    result.summary = `Total: ${count} rows`;
    result.explanation = `Database contains ${count} total rows`;
  }

  return result;
}

/**
 * Detect patterns in database
 */
export function detectPatterns(
  dbData: DatabaseBlockData,
  columnName?: string,
  patternType?: string
): PatternDetectionResult[] {
  const patterns: PatternDetectionResult[] = [];

  // If specific column provided
  if (columnName) {
    const column = dbData.columns.find(c => c.name.toLowerCase() === columnName.toLowerCase());
    if (column) {
      patterns.push(...detectColumnPatterns(dbData, column, patternType));
    }
  } else {
    // Analyze all columns
    patterns.push(...detectAllPatterns(dbData));
  }

  return patterns;
}

/**
 * Detect patterns across all columns
 */
function detectAllPatterns(dbData: DatabaseBlockData): PatternDetectionResult[] {
  const patterns: PatternDetectionResult[] = [];

  dbData.columns.forEach(column => {
    patterns.push(...detectColumnPatterns(dbData, column));
  });

  // Detect missing values
  const missingPattern = detectMissingValues(dbData);
  if (missingPattern) patterns.push(missingPattern);

  // Detect duplicates
  const duplicatePatterns = detectDuplicates(dbData);
  patterns.push(...duplicatePatterns);

  return patterns;
}

/**
 * Detect patterns for a specific column
 */
function detectColumnPatterns(
  dbData: DatabaseBlockData,
  column: DatabaseColumn,
  patternType?: string
): PatternDetectionResult[] {
  const patterns: PatternDetectionResult[] = [];

  // Number column patterns
  if (column.type === 'number' && (!patternType || patternType === 'trends' || patternType === 'anomalies')) {
    const stats = calculateColumnStats(dbData.rows, column.id);

    // Check for null values
    if (stats.nullCount > dbData.rows.length * 0.3) {
      patterns.push({
        type: 'missing',
        column: column.name,
        description: `${Math.round((stats.nullCount / dbData.rows.length) * 100)}% of values are missing`,
        severity: stats.nullCount > dbData.rows.length * 0.5 ? 'high' : 'medium',
        affected_rows: stats.nullCount,
      });
    }

    // Check for anomalies (values far from average)
    if (stats.count > 0) {
      const anomalies = detectNumericalAnomalies(dbData.rows, column.id, stats);
      if (anomalies.count > 0) {
        patterns.push({
          type: 'anomaly',
          column: column.name,
          description: `${anomalies.count} values are statistical outliers`,
          severity: anomalies.count > stats.count * 0.1 ? 'medium' : 'low',
          affected_rows: anomalies.count,
          details: anomalies,
        });
      }
    }
  }

  // Date column patterns
  if (column.type === 'date' && (!patternType || patternType === 'trends')) {
    const dateRange = getDateRange(dbData.rows, column.id);
    if (dateRange.earliest && dateRange.latest) {
      patterns.push({
        type: 'trend',
        column: column.name,
        description: `Date range spans ${dateRange.span} days (${dateRange.earliest.toLocaleDateString()} to ${dateRange.latest.toLocaleDateString()})`,
        severity: 'low',
        details: dateRange,
      });
    }
  }

  // Categorical column patterns
  if ((column.type === 'select' || column.type === 'text') && (!patternType || patternType === 'trends')) {
    const distribution = getValueDistribution(dbData.rows, column.id);
    const values = Object.keys(distribution);

    // Check for highly concentrated values
    const maxCount = Math.max(...Object.values(distribution));
    if (maxCount > dbData.rows.length * 0.7) {
      const dominantValue = values.find(v => distribution[v] === maxCount);
      patterns.push({
        type: 'trend',
        column: column.name,
        description: `Value "${dominantValue}" dominates with ${Math.round((maxCount / dbData.rows.length) * 100)}% occurrence`,
        severity: 'low',
        details: { distribution },
      });
    }
  }

  return patterns;
}

/**
 * Detect missing values across database
 */
function detectMissingValues(dbData: DatabaseBlockData): PatternDetectionResult | null {
  let totalCells = dbData.rows.length * dbData.columns.length;
  let missingCells = 0;

  dbData.rows.forEach(row => {
    dbData.columns.forEach(col => {
      const value = row.data[col.id];
      if (value === null || value === undefined || value === '') {
        missingCells++;
      }
    });
  });

  const missingPercentage = (missingCells / totalCells) * 100;

  if (missingPercentage > 10) {
    return {
      type: 'missing',
      description: `${missingPercentage.toFixed(1)}% of all cells are empty`,
      severity: missingPercentage > 30 ? 'high' : 'medium',
      affected_rows: missingCells,
    };
  }

  return null;
}

/**
 * Detect duplicate rows
 */
function detectDuplicates(dbData: DatabaseBlockData): PatternDetectionResult[] {
  const patterns: PatternDetectionResult[] = [];
  const rowSignatures = new Map<string, number>();

  dbData.rows.forEach(row => {
    // Create signature from all cell values
    const signature = dbData.columns
      .map(col => String(row.data[col.id] ?? ''))
      .join('|');

    rowSignatures.set(signature, (rowSignatures.get(signature) || 0) + 1);
  });

  let duplicateCount = 0;
  rowSignatures.forEach(count => {
    if (count > 1) duplicateCount += count - 1;
  });

  if (duplicateCount > 0) {
    patterns.push({
      type: 'duplicate',
      description: `${duplicateCount} duplicate rows detected`,
      severity: duplicateCount > 5 ? 'medium' : 'low',
      affected_rows: duplicateCount,
    });
  }

  return patterns;
}

/**
 * Detect numerical anomalies using standard deviation
 */
function detectNumericalAnomalies(
  rows: DatabaseRowData[],
  columnId: string,
  stats: ReturnType<typeof calculateColumnStats>
): { count: number; threshold: number } {
  if (stats.count === 0) return { count: 0, threshold: 0 };

  // Calculate standard deviation
  const values = rows
    .map(row => row.data[columnId])
    .filter(val => typeof val === 'number' && !isNaN(val)) as number[];

  const variance = values.reduce((sum, val) => sum + Math.pow(val - stats.avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const threshold = 2 * stdDev; // 2 standard deviations

  const anomalyCount = values.filter(val => Math.abs(val - stats.avg) > threshold).length;

  return { count: anomalyCount, threshold };
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(
  dbData: DatabaseBlockData,
  statistics: Record<string, any>
): string[] {
  const recommendations: string[] = [];

  // Check for missing date column
  const hasDateColumn = dbData.columns.some(col => col.type === 'date');
  if (!hasDateColumn && dbData.rows.length > 0) {
    recommendations.push('Consider adding a date column to track when entries were created or modified');
  }

  // Check for missing status/select column
  const hasSelectColumn = dbData.columns.some(col => col.type === 'select');
  if (!hasSelectColumn && dbData.rows.length > 5) {
    recommendations.push('Consider adding a status or category column to organize your data');
  }

  // Check for low data quality
  dbData.columns.forEach(col => {
    if (col.type === 'number') {
      const stats = statistics[col.name];
      if (stats && stats.nullCount > dbData.rows.length * 0.5) {
        recommendations.push(`Column "${col.name}" has many missing values - consider filling them or removing the column`);
      }
    }
  });

  // Suggest using different view
  if (dbData.view === 'table' && hasDateColumn) {
    recommendations.push('You have a date column - try the Calendar view to visualize entries by date');
  }

  if (dbData.rows.length > 10 && dbData.view === 'table') {
    recommendations.push('Try Gallery view for a more visual representation of your data');
  }

  return recommendations;
}

/**
 * Generate human-readable insights
 */
function generateInsights(
  dbData: DatabaseBlockData,
  statistics: Record<string, any>
): string[] {
  const insights: string[] = [];

  // Overall data insights
  if (dbData.rows.length === 0) {
    insights.push('Your database is empty. Start by adding some rows!');
    return insights;
  }

  insights.push(`Your database contains ${dbData.rows.length} ${dbData.rows.length === 1 ? 'entry' : 'entries'} across ${dbData.columns.length} columns`);

  // Column-specific insights
  dbData.columns.forEach(col => {
    const colStats = statistics[col.name];
    if (!colStats) return;

    if (col.type === 'number') {
      if (colStats.count > 0) {
        insights.push(`${col.name}: Average is ${colStats.avg.toFixed(2)}, ranging from ${colStats.min} to ${colStats.max}`);
      }
    } else if (col.type === 'select' && colStats.distribution) {
      const topValue = Object.entries(colStats.distribution)
        .sort(([, a], [, b]) => (b as number) - (a as number))[0];
      if (topValue) {
        insights.push(`Most common ${col.name}: "${topValue[0]}" (${topValue[1]} entries)`);
      }
    } else if (col.type === 'checkbox') {
      insights.push(`${col.name}: ${colStats.trueCount} checked (${colStats.percentage.toFixed(0)}%)`);
    } else if (col.type === 'date' && colStats.earliest) {
      insights.push(`${col.name}: Spans from ${new Date(colStats.earliest).toLocaleDateString()} to ${new Date(colStats.latest).toLocaleDateString()}`);
    }
  });

  return insights;
}

// ========================================
// QUERY PARSING & EXECUTION
// ========================================

interface QueryIntent {
  type: 'filter' | 'aggregate' | 'search' | 'count' | 'unknown';
  column?: string;
  operation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
  condition?: string;
  value?: any;
  searchTerm?: string;
}

function parseQueryIntent(query: string): QueryIntent {
  // Aggregation queries
  if (query.includes('average') || query.includes('avg')) {
    const column = extractColumnName(query);
    return { type: 'aggregate', operation: 'avg', column };
  }
  if (query.includes('sum') || query.includes('total')) {
    const column = extractColumnName(query);
    return { type: 'aggregate', operation: 'sum', column };
  }
  if (query.includes('minimum') || query.includes('min')) {
    const column = extractColumnName(query);
    return { type: 'aggregate', operation: 'min', column };
  }
  if (query.includes('maximum') || query.includes('max')) {
    const column = extractColumnName(query);
    return { type: 'aggregate', operation: 'max', column };
  }

  // Count queries
  if (query.includes('how many') || query.includes('count')) {
    return { type: 'count' };
  }

  // Filter queries
  if (query.includes('where') || query.includes('filter') || query.includes('show')) {
    const column = extractColumnName(query);
    const condition = extractCondition(query);
    const value = extractValue(query);
    return { type: 'filter', column, condition, value };
  }

  // Search queries
  if (query.includes('find') || query.includes('search') || query.includes('containing')) {
    const searchTerm = extractSearchTerm(query);
    return { type: 'search', searchTerm };
  }

  return { type: 'unknown' };
}

function extractColumnName(query: string): string | undefined {
  // Look for column name after common keywords
  const patterns = [
    /(?:column|field)\s+['"]?(\w+)['"]?/i,
    /['"](\w+)['"]\s+column/i,
    /(?:of|for)\s+['"]?(\w+)['"]?/i,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) return match[1];
  }

  return undefined;
}

function extractCondition(query: string): string | undefined {
  if (query.includes('equals') || query.includes('is')) return 'equals';
  if (query.includes('greater than') || query.includes('>')) return 'greater';
  if (query.includes('less than') || query.includes('<')) return 'less';
  if (query.includes('contains')) return 'contains';
  return 'equals';
}

function extractValue(query: string): any {
  // Extract quoted strings
  const quotedMatch = query.match(/['"]([^'"]+)['"]/);
  if (quotedMatch) return quotedMatch[1];

  // Extract numbers
  const numberMatch = query.match(/\b(\d+(?:\.\d+)?)\b/);
  if (numberMatch) return parseFloat(numberMatch[1]);

  return undefined;
}

function extractSearchTerm(query: string): string {
  // Extract quoted strings
  const quotedMatch = query.match(/['"]([^'"]+)['"]/);
  if (quotedMatch) return quotedMatch[1];

  // Extract last word as search term
  const words = query.split(' ');
  return words[words.length - 1];
}

function executeFilter(dbData: DatabaseBlockData, intent: QueryIntent): DatabaseRowData[] {
  if (!intent.column) return dbData.rows;

  const column = dbData.columns.find(c =>
    c.name.toLowerCase().includes(intent.column!.toLowerCase())
  );

  if (!column) return dbData.rows;

  return dbData.rows.filter(row => {
    const value = row.data[column.id];

    if (intent.condition === 'equals') {
      return String(value).toLowerCase() === String(intent.value).toLowerCase();
    } else if (intent.condition === 'greater') {
      return Number(value) > Number(intent.value);
    } else if (intent.condition === 'less') {
      return Number(value) < Number(intent.value);
    } else if (intent.condition === 'contains') {
      return String(value).toLowerCase().includes(String(intent.value).toLowerCase());
    }

    return true;
  });
}

function executeAggregation(dbData: DatabaseBlockData, intent: QueryIntent): any {
  if (!intent.column || !intent.operation) return null;

  const column = dbData.columns.find(c =>
    c.name.toLowerCase().includes(intent.column!.toLowerCase())
  );

  if (!column || column.type !== 'number') return null;

  const stats = calculateColumnStats(dbData.rows, column.id);

  switch (intent.operation) {
    case 'avg': return stats.avg;
    case 'sum': return stats.sum;
    case 'min': return stats.min;
    case 'max': return stats.max;
    case 'count': return stats.count;
    default: return null;
  }
}

function executeSearch(dbData: DatabaseBlockData, intent: QueryIntent): DatabaseRowData[] {
  if (!intent.searchTerm) return dbData.rows;

  const searchTerm = intent.searchTerm.toLowerCase();

  return dbData.rows.filter(row => {
    return dbData.columns.some(col => {
      const value = row.data[col.id];
      return String(value).toLowerCase().includes(searchTerm);
    });
  });
}

function formatAggregationResult(stats: any, intent: QueryIntent): string {
  if (stats === null) return 'Could not calculate';

  switch (intent.operation) {
    case 'avg': return `Average: ${stats.toFixed(2)}`;
    case 'sum': return `Total: ${stats}`;
    case 'min': return `Minimum: ${stats}`;
    case 'max': return `Maximum: ${stats}`;
    case 'count': return `Count: ${stats}`;
    default: return String(stats);
  }
}

/**
 * Get all AI tools for database
 */
export function getAllDatabaseAITools(): AIToolDefinition[] {
  return [
    ANALYZE_DATABASE_TOOL,
    QUERY_DATABASE_TOOL,
    DETECT_PATTERNS_TOOL,
    SUGGEST_COLUMNS_TOOL,
    GENERATE_INSIGHTS_TOOL,
  ];
}
