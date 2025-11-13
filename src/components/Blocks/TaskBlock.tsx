import React, { useState, useEffect } from 'react';
import { updateBlock } from '@/utils/tauri';
import { useBlocksStore } from '@/store';
import type { Block } from '@/types';
import { nanoid } from 'nanoid';

interface TaskBlockProps {
  block: Block;
}

interface Task {
  id: string;
  text: string;
  completed: boolean;
}

interface TaskBlockData {
  title?: string;
  tasks: Task[];
}

const TaskBlock: React.FC<TaskBlockProps> = ({ block }) => {
  const { updateBlock: updateBlockInStore } = useBlocksStore();
  const [data, setData] = useState<TaskBlockData>({
    tasks: [],
  });

  // Parse block data
  useEffect(() => {
    try {
      const parsed = JSON.parse(block.data);
      setData(parsed);
    } catch (error) {
      console.error('Failed to parse task block data:', error);
    }
  }, [block.data]);

  const saveData = async (newData: TaskBlockData) => {
    try {
      const updated = await updateBlock(block.id, JSON.stringify(newData));
      updateBlockInStore(block.id, updated);
      setData(newData);
    } catch (error) {
      console.error('Failed to update task block:', error);
    }
  };

  const handleToggleTask = (taskId: string) => {
    const newTasks = data.tasks.map((task) =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    );
    saveData({ ...data, tasks: newTasks });
  };

  const handleEditTask = (taskId: string, newText: string) => {
    const newTasks = data.tasks.map((task) =>
      task.id === taskId ? { ...task, text: newText } : task
    );
    saveData({ ...data, tasks: newTasks });
  };

  const handleAddTask = () => {
    const newTask: Task = {
      id: nanoid(),
      text: '',
      completed: false,
    };
    saveData({ ...data, tasks: [...data.tasks, newTask] });
  };

  const handleDeleteTask = (taskId: string) => {
    const newTasks = data.tasks.filter((task) => task.id !== taskId);
    saveData({ ...data, tasks: newTasks });
  };

  const handleKeyDown = (e: React.KeyboardEvent, taskId: string) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleAddTask();
    }
  };

  return (
    <div className="canvas-block task-block">
      <div className="block-handle">⋮⋮</div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-white">
          {data.title || 'Tasks'}
        </div>
        <button className="text-xs text-gray-500 hover:text-white">•••</button>
      </div>
      <div className="space-y-1">
        {data.tasks.map((task) => (
          <div key={task.id} className="task-item group">
            <div
              className={`task-checkbox ${task.completed ? 'checked' : ''}`}
              onClick={() => handleToggleTask(task.id)}
            >
              {task.completed && '✓'}
            </div>
            <input
              type="text"
              value={task.text}
              onChange={(e) => handleEditTask(task.id, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, task.id)}
              className="flex-1 text-sm bg-transparent border-none outline-none text-white"
              style={{
                textDecoration: task.completed ? 'line-through' : 'none',
                opacity: task.completed ? 0.6 : 1,
              }}
              placeholder="Task description..."
            />
            <button
              onClick={() => handleDeleteTask(task.id)}
              className="opacity-0 group-hover:opacity-100 text-xs text-red-500 hover:text-red-400 transition-opacity"
              title="Delete task"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={handleAddTask}
        className="mt-2 text-xs text-gray-500 hover:text-white"
      >
        + Add task
      </button>
      <div className="mt-2 text-xs text-gray-500">
        {data.tasks.filter((t) => t.completed).length} / {data.tasks.length} completed
      </div>
    </div>
  );
};

export default TaskBlock;
