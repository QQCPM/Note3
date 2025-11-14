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
    return JSON.parse(dataString) as BlockData;
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
