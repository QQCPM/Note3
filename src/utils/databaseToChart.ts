import type { DatabaseBlockData } from '@/types';
import { aggregateByColumn, exportDatabaseForAI } from './databaseAI';
import { generatePieChart } from './artifactTemplates';

/**
 * Generate a chart artifact from database data
 */
export function createChartFromDatabase(
  dbData: DatabaseBlockData,
  chartType: 'pie' | 'bar' = 'pie',
  options?: {
    groupByColumn?: string;
    valueColumn?: string;
    title?: string;
  }
): { title: string; html: string; css: string; javascript: string } {

  // Auto-detect columns if not specified
  let groupByColumn = options?.groupByColumn;
  let valueColumn = options?.valueColumn;

  if (!groupByColumn) {
    // Find first select or text column for grouping
    const selectCol = dbData.columns.find(c => c.type === 'select');
    const textCol = dbData.columns.find(c => c.type === 'text');
    groupByColumn = (selectCol || textCol)?.name || dbData.columns[0]?.name;
  }

  if (!valueColumn) {
    // Find first number column for values
    const numberCol = dbData.columns.find(c => c.type === 'number');
    valueColumn = numberCol?.name;
  }

  // Aggregate data
  let aggregatedData: Record<string, number>;

  if (valueColumn) {
    // Sum by group
    aggregatedData = aggregateByColumn(dbData, groupByColumn, valueColumn, 'sum');
  } else {
    // Count by group
    aggregatedData = aggregateByColumn(dbData, groupByColumn, groupByColumn, 'count');
  }

  const title = options?.title || `${dbData.title} - ${groupByColumn}`;

  if (chartType === 'pie') {
    return generatePieChart(aggregatedData, title);
  }

  // Default to pie for now
  return generatePieChart(aggregatedData, title);
}

/**
 * Detect if a prompt is requesting a chart from database
 */
export function isChartRequest(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return (
    (lower.includes('chart') || lower.includes('graph') || lower.includes('visualiz')) &&
    (lower.includes('database') || lower.includes('data') || lower.includes('show'))
  );
}
