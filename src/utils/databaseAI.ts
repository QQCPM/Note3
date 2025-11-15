import type { DatabaseBlockData, DatabaseColumn } from '@/types';

/**
 * Export database for AI consumption - converts to AI-friendly format
 */
export function exportDatabaseForAI(dbData: DatabaseBlockData) {
  const schema = {
    title: dbData.title,
    columns: dbData.columns.map(col => ({
      id: col.id,
      name: col.name,
      type: col.type,
      options: col.options,
    })),
  };

  // Convert row data from column IDs to column names
  const data = dbData.rows.map(row => {
    const rowData: Record<string, any> = {};
    dbData.columns.forEach(col => {
      rowData[col.name] = row.data[col.id];
    });
    return rowData;
  });

  // Calculate statistics
  const statistics: Record<string, any> = {};
  dbData.columns.forEach(col => {
    if (col.type === 'number') {
      const values = dbData.rows
        .map(row => row.data[col.id])
        .filter(v => v != null && !isNaN(Number(v)))
        .map(Number);

      if (values.length > 0) {
        statistics[col.name] = {
          count: values.length,
          sum: values.reduce((a, b) => a + b, 0),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
        };
      }
    } else if (col.type === 'select') {
      const distribution: Record<string, number> = {};
      dbData.rows.forEach(row => {
        const val = row.data[col.id];
        if (val) {
          distribution[String(val)] = (distribution[String(val)] || 0) + 1;
        }
      });
      statistics[col.name] = { distribution };
    }
  });

  return { schema, data, statistics, rowCount: dbData.rows.length };
}

/**
 * Aggregate database data by column
 */
export function aggregateByColumn(
  dbData: DatabaseBlockData,
  groupByColumn: string,
  valueColumn: string,
  operation: 'sum' | 'count' | 'avg' = 'sum'
) {
  const groupCol = dbData.columns.find(c => c.name === groupByColumn);
  const valueCol = dbData.columns.find(c => c.name === valueColumn);

  if (!groupCol) throw new Error(`Column "${groupByColumn}" not found`);

  const result: Record<string, number> = {};

  dbData.rows.forEach(row => {
    const groupValue = String(row.data[groupCol.id] || 'Unknown');
    const value = valueCol ? Number(row.data[valueCol.id]) : 1;

    if (operation === 'count') {
      result[groupValue] = (result[groupValue] || 0) + 1;
    } else if (operation === 'sum') {
      result[groupValue] = (result[groupValue] || 0) + (isNaN(value) ? 0 : value);
    }
  });

  // Calculate average if needed
  if (operation === 'avg') {
    const counts: Record<string, number> = {};
    dbData.rows.forEach(row => {
      const groupValue = String(row.data[groupCol.id] || 'Unknown');
      counts[groupValue] = (counts[groupValue] || 0) + 1;
    });
    Object.keys(result).forEach(key => {
      result[key] = result[key] / counts[key];
    });
  }

  return result;
}

/**
 * Infer column type from name and sample data
 */
export function inferColumnType(
  columnName: string,
  sampleValues: any[]
): 'text' | 'number' | 'date' | 'select' | 'checkbox' {
  const lowerName = columnName.toLowerCase();

  // Check name patterns
  if (lowerName.includes('date') || lowerName.includes('time')) return 'date';
  if (lowerName.includes('completed') || lowerName.includes('done')) return 'checkbox';
  if (lowerName.includes('status') || lowerName.includes('category') || lowerName.includes('type')) return 'select';
  if (lowerName.includes('amount') || lowerName.includes('price') || lowerName.includes('cost') || lowerName.includes('count')) return 'number';

  // Analyze sample values
  const nonNull = sampleValues.filter(v => v != null && v !== '');
  if (nonNull.length === 0) return 'text';

  const allNumbers = nonNull.every(v => !isNaN(Number(v)));
  if (allNumbers) return 'number';

  const allBooleans = nonNull.every(v => v === true || v === false);
  if (allBooleans) return 'checkbox';

  const uniqueValues = new Set(nonNull.map(String));
  if (uniqueValues.size <= 10 && nonNull.length > 10) return 'select';

  return 'text';
}
