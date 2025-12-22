// Root Node Navigation Utility
// Handles navigation to root node definitions when clicking @mentions

import type { RootNode } from '@/types/rootNode';
import { getRootNodeByTerm } from '@/services/rootNodeService';

export interface NavigationTarget {
  noteId: string;
  blockId: string;
  startOffset: number;
  endOffset: number;
}

/**
 * Navigate to a root node's source location
 * @param rootNode The root node to navigate to
 * @returns Promise that resolves when navigation is complete
 */
export async function navigateToRootNode(rootNode: RootNode): Promise<void> {
  const { useNotesStore } = await import('@/store/notesStore');
  
  // Set the active note to the root node's source note
  useNotesStore.getState().setActiveNote(rootNode.note_id);
  
  // After a short delay to allow the note to load, scroll to the block
  setTimeout(() => {
    scrollToBlock(rootNode.block_id, rootNode.start_offset, rootNode.end_offset);
  }, 100);
}

/**
 * Navigate to a root node by its term
 * @param term The term to search for (e.g., "Backpropagation")
 * @param projectId Optional project ID to scope the search
 */
export async function navigateToRootNodeByTerm(
  term: string,
  projectId?: string | null
): Promise<boolean> {
  try {
    const rootNode = await getRootNodeByTerm(term, projectId);
    
    if (rootNode) {
      await navigateToRootNode(rootNode);
      return true;
    }
    
    console.warn(`Root node not found for term: ${term}`);
    return false;
  } catch (error) {
    console.error('Failed to navigate to root node:', error);
    return false;
  }
}

/**
 * Scroll to a specific block and highlight a range
 */
function scrollToBlock(blockId: string, startOffset: number, endOffset: number): void {
  // Find the block element
  const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
  
  if (blockElement) {
    // Scroll the block into view
    blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Add a temporary highlight effect
    blockElement.classList.add('root-node-highlight');
    setTimeout(() => {
      blockElement.classList.remove('root-node-highlight');
    }, 2000);
    
    // Try to select the text range if possible
    try {
      const textContent = blockElement.textContent || '';
      if (startOffset >= 0 && endOffset <= textContent.length) {
        // Create a selection for the highlighted text
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          const textNode = findTextNode(blockElement, startOffset);
          
          if (textNode) {
            range.setStart(textNode.node, textNode.offset);
            range.setEnd(textNode.node, Math.min(textNode.offset + (endOffset - startOffset), textNode.node.textContent?.length || 0));
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }
    } catch (e) {
      // Selection failed, but scroll worked
      console.warn('Could not select text range:', e);
    }
  }
}

/**
 * Find the text node and offset for a given character position
 */
function findTextNode(element: Element, targetOffset: number): { node: Text; offset: number } | null {
  let currentOffset = 0;
  
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const length = node.textContent?.length || 0;
    if (currentOffset + length >= targetOffset) {
      return {
        node,
        offset: targetOffset - currentOffset,
      };
    }
    currentOffset += length;
  }
  
  return null;
}

/**
 * Parse @mentions from text and return navigation targets
 */
export function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+(?:\s+\w+)*)/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  
  return mentions;
}
