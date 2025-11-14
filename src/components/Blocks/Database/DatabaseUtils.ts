import type { DatabaseColumn, DatabaseRowData, DatabaseBlockData } from '@/types';
import { nanoid } from 'nanoid';

// ========================================
// ROW OPERATIONS
// ========================================

/**
 * Create a new empty row with default values based on column types
 */
export function createEmptyRow(columns: DatabaseColumn[]): DatabaseRowData {
  const data: Record<string, any> = {};

  columns.forEach(col => {
    switch (col.type) {
      case 'text':
        data[col.id] = '';
        break;
      case 'number':
        data[col.id] = null;
        break;
      case 'date':
        data[col.id] = null;
        break;
      case 'select':
        data[col.id] = '';
        break;
      case 'checkbox':
        data[col.id] = false;
        break;
      default:
        data[col.id] = '';
    }
  });

  return {
    id: nanoid(),
    data,
  };
}

/**
 * Update a cell value in a row
 */
export function updateCellValue(
  row: DatabaseRowData,
  columnId: string,
  value: any
): DatabaseRowData {
  return {
    ...row,
    data: {
      ...row.data,
      [columnId]: value,
    },
  };
}

/**
 * Delete a row by ID
 */
export function deleteRow(
  rows: DatabaseRowData[],
  rowId: string
): DatabaseRowData[] {
  return rows.filter(row => row.id !== rowId);
}

// ========================================
// COLUMN OPERATIONS
// ========================================

/**
 * Create a new column
 */
export function createColumn(
  name: string,
  type: DatabaseColumn['type'],
  options?: string[]
): DatabaseColumn {
  return {
    id: nanoid(),
    name,
    type,
    options,
  };
}

/**
 * Delete a column and remove its data from all rows
 */
export function deleteColumn(
  columns: DatabaseColumn[],
  rows: DatabaseRowData[],
  columnId: string
): { columns: DatabaseColumn[]; rows: DatabaseRowData[] } {
  const newColumns = columns.filter(col => col.id !== columnId);

  const newRows = rows.map(row => {
    const { [columnId]: _, ...restData } = row.data;
    return {
      ...row,
      data: restData,
    };
  });

  return { columns: newColumns, rows: newRows };
}

/**
 * Update column metadata (name, type, options)
 */
export function updateColumn(
  columns: DatabaseColumn[],
  columnId: string,
  updates: Partial<DatabaseColumn>
): DatabaseColumn[] {
  return columns.map(col =>
    col.id === columnId
      ? { ...col, ...updates }
      : col
  );
}

/**
 * Reorder columns
 */
export function reorderColumns(
  columns: DatabaseColumn[],
  fromIndex: number,
  toIndex: number
): DatabaseColumn[] {
  const result = [...columns];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

// ========================================
// AI-READY: STATISTICS & AGGREGATIONS
// ========================================

/**
 * Calculate statistics for a number column (AI-ready)
 */
export function calculateColumnStats(
  rows: DatabaseRowData[],
  columnId: string
): {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  nullCount: number;
} {
  const values = rows
    .map(row => row.data[columnId])
    .filter(val => typeof val === 'number' && !isNaN(val)) as number[];

  const nullCount = rows.length - values.length;

  if (values.length === 0) {
    return { count: 0, sum: 0, avg: 0, min: 0, max: 0, nullCount };
  }

  const sum = values.reduce((acc, val) => acc + val, 0);
  const avg = sum / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  return {
    count: values.length,
    sum,
    avg,
    min,
    max,
    nullCount,
  };
}

/**
 * Get value distribution for select/categorical columns (AI-ready)
 */
export function getValueDistribution(
  rows: DatabaseRowData[],
  columnId: string
): Record<string, number> {
  const distribution: Record<string, number> = {};

  rows.forEach(row => {
    const value = row.data[columnId];
    const key = value?.toString() || '(empty)';
    distribution[key] = (distribution[key] || 0) + 1;
  });

  return distribution;
}

/**
 * Count rows matching a condition (AI-ready for boolean analysis)
 */
export function countMatchingRows(
  rows: DatabaseRowData[],
  columnId: string,
  condition: (value: any) => boolean
): number {
  return rows.filter(row => condition(row.data[columnId])).length;
}

/**
 * Get date range for date columns (AI-ready for temporal analysis)
 */
export function getDateRange(
  rows: DatabaseRowData[],
  columnId: string
): {
  earliest: Date | null;
  latest: Date | null;
  span: number; // days
} {
  const dates = rows
    .map(row => row.data[columnId])
    .filter(val => val)
    .map(val => new Date(val))
    .filter(date => !isNaN(date.getTime()));

  if (dates.length === 0) {
    return { earliest: null, latest: null, span: 0 };
  }

  const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
  const latest = new Date(Math.max(...dates.map(d => d.getTime())));
  const span = Math.ceil((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24));

  return { earliest, latest, span };
}

/**
 * Full-text search across all text columns (AI-ready)
 */
export function searchRows(
  rows: DatabaseRowData[],
  columns: DatabaseColumn[],
  query: string
): DatabaseRowData[] {
  const lowerQuery = query.toLowerCase();
  const textColumnIds = columns
    .filter(col => col.type === 'text')
    .map(col => col.id);

  return rows.filter(row => {
    return textColumnIds.some(colId => {
      const value = row.data[colId];
      return value?.toString().toLowerCase().includes(lowerQuery);
    });
  });
}

/**
 * Export database to AI-consumable JSON format
 */
export function exportForAI(dbData: DatabaseBlockData): {
  schema: {
    title: string;
    columns: Array<{
      name: string;
      type: string;
      options?: string[];
    }>;
  };
  data: Array<Record<string, any>>;
  statistics: Record<string, any>;
} {
  const schema = {
    title: dbData.title,
    columns: dbData.columns.map(col => ({
      name: col.name,
      type: col.type,
      options: col.options,
    })),
  };

  // Convert rows to use column names instead of IDs
  const data = dbData.rows.map(row => {
    const rowData: Record<string, any> = {};
    dbData.columns.forEach(col => {
      rowData[col.name] = row.data[col.id];
    });
    return rowData;
  });

  // Calculate statistics for each column
  const statistics: Record<string, any> = {};
  dbData.columns.forEach(col => {
    if (col.type === 'number') {
      statistics[col.name] = calculateColumnStats(dbData.rows, col.id);
    } else if (col.type === 'select' || col.type === 'text') {
      statistics[col.name] = {
        distribution: getValueDistribution(dbData.rows, col.id),
      };
    } else if (col.type === 'date') {
      statistics[col.name] = getDateRange(dbData.rows, col.id);
    } else if (col.type === 'checkbox') {
      const trueCount = countMatchingRows(dbData.rows, col.id, val => val === true);
      statistics[col.name] = {
        trueCount,
        falseCount: dbData.rows.length - trueCount,
        percentage: (trueCount / dbData.rows.length) * 100,
      };
    }
  });

  return { schema, data, statistics };
}

/**
 * Validate database data integrity
 */
export function validateDatabase(dbData: DatabaseBlockData): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for duplicate column IDs
  const columnIds = new Set<string>();
  dbData.columns.forEach(col => {
    if (columnIds.has(col.id)) {
      errors.push(`Duplicate column ID: ${col.id}`);
    }
    columnIds.add(col.id);
  });

  // Check for duplicate row IDs
  const rowIds = new Set<string>();
  dbData.rows.forEach(row => {
    if (rowIds.has(row.id)) {
      errors.push(`Duplicate row ID: ${row.id}`);
    }
    rowIds.add(row.id);
  });

  // Check that all row data matches column schema
  dbData.rows.forEach((row, rowIndex) => {
    dbData.columns.forEach(col => {
      if (!(col.id in row.data)) {
        errors.push(`Row ${rowIndex} missing data for column: ${col.name}`);
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
