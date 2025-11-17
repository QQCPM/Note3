import React, { useState } from 'react';
import { Maximize2, AlignLeft, AlignCenter, AlignRight, Trash2 } from 'lucide-react';
import { updateBlock, deleteBlock } from '@/utils/tauri';
import { ask } from '@tauri-apps/plugin-dialog';
import { useBlocksStore } from '@/store';
import type { Block, BlockData, BlockLayout } from '@/types';

interface BlockLayoutControlsProps {
  block: Block;
}

const BlockLayoutControls: React.FC<BlockLayoutControlsProps> = ({ block }) => {
  const { updateBlock: updateBlockInStore, deleteBlock: deleteBlockInStore } = useBlocksStore();
  const [isOpen, setIsOpen] = useState(false);

  const currentAlignment = block.data.alignment || 'left';

  const handleAlignmentChange = async (alignment: BlockLayout['alignment']) => {
    try {
      const newData: BlockData = { ...block.data, alignment };
      const updated = await updateBlock(block.id, newData);
      updateBlockInStore(block.id, updated);
    } catch (error) {
      console.error('Failed to update block alignment:', error);
    }
  };

  const handleDeleteBlock = async () => {
    try {
      const confirmed = await ask('Are you sure you want to delete this block?', {
        title: 'Delete Block',
        kind: 'warning',
      });

      if (confirmed) {
        await deleteBlock(block.id);
        deleteBlockInStore(block.id);
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Failed to delete block:', error);
      await ask(`Failed to delete block: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        title: 'Error',
        kind: 'error',
      });
    }
  };

  return (
    <div className="relative">
      {/* Layout Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 text-xs bg-white/5 hover:bg-white/10 rounded transition-all"
        title="Alignment"
      >
        <Maximize2 className="w-4 h-4" />
      </button>

      {/* Layout Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 top-full mt-2 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl z-50 p-3 min-w-[140px]">
            {/* Alignment Options */}
            <div>
              <div className="text-xs text-gray-400 mb-2 font-semibold">Position</div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAlignmentChange('left')}
                  className={`flex-1 p-2 rounded transition-all flex items-center justify-center ${
                    currentAlignment === 'left'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                  title="Align Left"
                >
                  <AlignLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleAlignmentChange('center')}
                  className={`flex-1 p-2 rounded transition-all flex items-center justify-center ${
                    currentAlignment === 'center'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                  title="Align Center"
                >
                  <AlignCenter className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleAlignmentChange('right')}
                  className={`flex-1 p-2 rounded transition-all flex items-center justify-center ${
                    currentAlignment === 'right'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                  title="Align Right"
                >
                  <AlignRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Delete Block */}
            <div className="mt-3 pt-3 border-t border-[#30363d]">
              <button
                onClick={handleDeleteBlock}
                className="w-full p-2 rounded transition-all flex items-center justify-center gap-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30"
                title="Delete Block"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-xs font-medium">Delete Block</span>
              </button>
            </div>

            {/* Tip */}
            <div className="mt-3 pt-3 border-t border-[#30363d]">
              <div className="text-xs text-gray-500">
                💡 Hover edges to resize
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BlockLayoutControls;
