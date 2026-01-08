import React, { useState, useEffect } from 'react';
import type { Block, TaskBlockData, Task } from '@/types';
import { updateBlock } from '@/utils/tauri';

interface TaskBlockProps {
  block: Block;
}

const TaskBlock: React.FC<TaskBlockProps> = ({ block }) => {
  const data = block.data as TaskBlockData;
  const [tasks, setTasks] = useState<Task[]>(data.tasks || []);
  const [title, setTitle] = useState(data.title || 'Tasks');

  // Update local state when block data changes
  useEffect(() => {
    const newData = block.data as TaskBlockData;
    setTasks(newData.tasks || []);
    setTitle(newData.title || 'Tasks');
  }, [block.data]);

  const handleToggleTask = async (taskId: string) => {
    const updatedTasks = tasks.map(task =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    );
    setTasks(updatedTasks);

    // Persist to database
    try {
      await updateBlock(block.id, {
        ...data,
        tasks: updatedTasks
      });
    } catch (err) {
      console.error('Failed to update task block:', err);
    }
  };

  return (
    <div className="canvas-block task-block">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-white">{title}</div>
        <button className="text-xs text-gray-500 hover:text-white">•••</button>
      </div>

      <div className="space-y-1">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <div key={task.id} className="task-item">
              <div
                className={`task-checkbox ${task.completed ? 'checked' : ''}`}
                onClick={() => handleToggleTask(task.id)}
              >
                {task.completed && '✓'}
              </div>
              <span
                className="text-sm"
                style={{
                  textDecoration: task.completed ? 'line-through' : 'none',
                  opacity: task.completed ? 0.6 : 1
                }}
              >
                {task.text}
              </span>
            </div>
          ))
        ) : (
          <div className="text-sm text-gray-500 italic">No tasks yet</div>
        )}
      </div>

      <button className="mt-2 text-xs text-gray-500 hover:text-white">+ Add task</button>
    </div>
  );
};

export default TaskBlock;
