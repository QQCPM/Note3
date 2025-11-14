import React from 'react';
import type { Block } from '@/types';

interface TaskBlockProps {
  block: Block;
}

const TaskBlock: React.FC<TaskBlockProps> = ({ block: _block }) => {
  const handleCheckboxClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.classList.toggle('checked');
    const text = e.currentTarget.nextElementSibling as HTMLSpanElement;
    if (text) {
      text.style.textDecoration = e.currentTarget.classList.contains('checked') ? 'line-through' : 'none';
      text.style.opacity = e.currentTarget.classList.contains('checked') ? '0.6' : '1';
    }
  };

  return (
    <div className="canvas-block task-block">
      <div className="block-handle">⋮⋮</div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-white">This Week's Tasks</div>
        <button className="text-xs text-gray-500 hover:text-white">•••</button>
      </div>
      <div className="space-y-1">
        <div className="task-item">
          <div className="task-checkbox checked" onClick={handleCheckboxClick}>✓</div>
          <span className="text-sm" style={{ textDecoration: 'line-through', opacity: 0.6 }}>Review backpropagation notes</span>
        </div>
        <div className="task-item">
          <div className="task-checkbox" onClick={handleCheckboxClick}></div>
          <span className="text-sm">Complete CNN implementation</span>
        </div>
        <div className="task-item">
          <div className="task-checkbox" onClick={handleCheckboxClick}></div>
          <span className="text-sm">Study for midterm exam</span>
        </div>
        <div className="task-item">
          <div className="task-checkbox" onClick={handleCheckboxClick}></div>
          <span className="text-sm">Practice with TensorFlow</span>
        </div>
      </div>
      <button className="mt-2 text-xs text-gray-500 hover:text-white">+ Add task</button>
    </div>
  );
};

export default TaskBlock;
