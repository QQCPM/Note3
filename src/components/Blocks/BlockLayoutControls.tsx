import React, { useState } from 'react';
import { Maximize2, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { updateBlock } from '@/utils/tauri';
import { useBlocksStore } from '@/store';
import type { Block, BlockData, BlockLayout } from '@/types';

interface BlockLayoutControlsProps {
  block: Block;
}

const BlockLayoutControls: React.FC<BlockLayoutControlsProps> = ({ block }) => {
  const { updateBlock: updateBlockInStore } = useBlocksStore();
  const [isOpen, setIsOpen] = useState(false);

  const currentWidth = block.data.width || 'full';
  const currentAlignment = block.data.alignment || 'left';

  const handleWidthChange = async (width: BlockLayout['width']) => {
    try {
      const newData: BlockData = { ...block.data, width };
      const updated = await updateBlock(block.id, newData);
      updateBlockInStore(block.id, updated);
    } catch (error) {
      console.error('Failed to update block width:', error);
    }
  };

  const handleAlignmentChange = async (alignment: BlockLayout['alignment']) => {
    try {
      const newData: BlockData = { ...block.data, alignment };
      const updated = await updateBlock(block.id, newData);
      updateBlockInStore(block.id, updated);
    } catch (error) {
      console.error('Failed to update block alignment:', error);
    }
  };

  return (
    <div className="relative">
      {/* Layout Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 text-xs bg-white/5 hover:bg-white/10 rounded transition-all"
        title="Layout Options"
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
          <div className="absolute right-0 top-full mt-2 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl z-50 p-3 min-w-[200px]">
            {/* Width Options */}
            <div className="mb-3">
              <div className="text-xs text-gray-400 mb-2 font-semibold">Width</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleWidthChange('full')}
                  className={`px-3 py-2 text-xs rounded transition-all ${
                    currentWidth === 'full'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  Full
                </button>
                <button
                  onClick={() => handleWidthChange('half')}
                  className={`px-3 py-2 text-xs rounded transition-all ${
                    currentWidth === 'half'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  1/2
                </button>
                <button
                  onClick={() => handleWidthChange('third')}
                  className={`px-3 py-2 text-xs rounded transition-all ${
                    currentWidth === 'third'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  1/3
                </button>
                <button
                  onClick={() => handleWidthChange('quarter')}
                  className={`px-3 py-2 text-xs rounded transition-all ${
                    currentWidth === 'quarter'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  1/4
                </button>
              </div>
            </div>

            {/* Alignment Options */}
            <div>
              <div className="text-xs text-gray-400 mb-2 font-semibold">Alignment</div>
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
          </div>
        </>
      )}
    </div>
  );
};

export default BlockLayoutControls;
