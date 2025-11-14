import type { Block, BlockData, TauriBlock } from '@/types';

/**
 * Serialize BlockData to string for Tauri commands
 */
export function serializeBlockData(data: BlockData): string {
  return JSON.stringify(data);
}

/**
 * Deserialize string to BlockData from Tauri responses
 */
export function deserializeBlockData(dataString: string): BlockData {
  try {
    const parsed = JSON.parse(dataString) as BlockData;
    
    // Special handling for database blocks to ensure data integrity
    if (parsed.type === 'database') {
      const dbData = parsed as any;
      if (!dbData.rows) dbData.rows = [];
      if (!dbData.columns) dbData.columns = [];
      if (!dbData.title) dbData.title = 'Untitled Database';
      if (!dbData.view) dbData.view = 'table';
      
      // Ensure all rows have valid data objects
      dbData.rows = dbData.rows.map((row: any) => {
        if (!row.id) row.id = Math.random().toString(36).substring(7);
        if (!row.data || typeof row.data !== 'object') {
          row.data = {};
        }
        return row;
      });
    }
    
    return parsed;
  } catch (error) {
    console.error('Failed to parse block data:', error);
    return { type: 'text', content: '' };
  }
}

/**
 * Convert Tauri Block (with string data) to typed Block
 */
export function parseBlock(tauriBlock: TauriBlock): Block {
  return {
    ...tauriBlock,
    data: deserializeBlockData(tauriBlock.data),
  };
}

/**
 * Convert typed Block to Tauri format (with string data)
 */
export function stringifyBlock(block: Block): TauriBlock {
  return {
    ...block,
    data: serializeBlockData(block.data),
  };
}
