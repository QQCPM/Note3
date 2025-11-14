import React, { useState, useRef, useEffect } from 'react';
import type { DatabaseColumn } from '@/types';

// ========================================
// TEXT CELL EDITOR
// ========================================
interface TextCellProps {
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export const TextCellEditor: React.FC<TextCellProps> = ({ value, onSave, onCancel }) => {
  const [editValue, setEditValue] = useState(value || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave(editValue);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onSave(editValue)}
      className="w-full px-2 py-1 bg-[#0d1117] border border-blue-500 rounded text-sm text-white focus:outline-none"
    />
  );
};

// ========================================
// NUMBER CELL EDITOR
// ========================================
interface NumberCellProps {
  value: number | null;
  onSave: (value: number | null) => void;
  onCancel: () => void;
}

export const NumberCellEditor: React.FC<NumberCellProps> = ({ value, onSave, onCancel }) => {
  const [editValue, setEditValue] = useState(value?.toString() || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const numValue = editValue === '' ? null : parseFloat(editValue);
      onSave(isNaN(numValue as number) ? null : numValue);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleSave = () => {
    const numValue = editValue === '' ? null : parseFloat(editValue);
    onSave(isNaN(numValue as number) ? null : numValue);
  };

  return (
    <input
      ref={inputRef}
      type="number"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleSave}
      className="w-full px-2 py-1 bg-[#0d1117] border border-blue-500 rounded text-sm text-white focus:outline-none"
      step="any"
    />
  );
};

// ========================================
// DATE CELL EDITOR
// ========================================
interface DateCellProps {
  value: string | null;
  onSave: (value: string | null) => void;
  onCancel: () => void;
}

export const DateCellEditor: React.FC<DateCellProps> = ({ value, onSave, onCancel }) => {
  const [editValue, setEditValue] = useState(value || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave(editValue || null);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      type="date"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onSave(editValue || null)}
      className="w-full px-2 py-1 bg-[#0d1117] border border-blue-500 rounded text-sm text-white focus:outline-none"
    />
  );
};

// ========================================
// SELECT CELL EDITOR
// ========================================
interface SelectCellProps {
  value: string;
  column: DatabaseColumn;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export const SelectCellEditor: React.FC<SelectCellProps> = ({ value, column, onSave, onCancel }) => {
  const [editValue, setEditValue] = useState(value || '');
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleChange = (newValue: string) => {
    setEditValue(newValue);
    onSave(newValue); // Auto-save on change for select
  };

  const options = column.options || [];

  return (
    <select
      ref={selectRef}
      value={editValue}
      onChange={(e) => handleChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onSave(editValue)}
      className="w-full px-2 py-1 bg-[#0d1117] border border-blue-500 rounded text-sm text-white focus:outline-none"
    >
      <option value="">Select...</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
};

// ========================================
// CHECKBOX CELL EDITOR
// ========================================
interface CheckboxCellProps {
  value: boolean;
  onSave: (value: boolean) => void;
}

export const CheckboxCellEditor: React.FC<CheckboxCellProps> = ({ value, onSave }) => {
  const handleToggle = () => {
    onSave(!value);
  };

  return (
    <div className="flex items-center justify-center w-full h-full">
      <input
        type="checkbox"
        checked={value || false}
        onChange={handleToggle}
        className="w-4 h-4 cursor-pointer"
      />
    </div>
  );
};

// ========================================
// CELL RENDERER (Read-only display)
// ========================================
interface CellRendererProps {
  column: DatabaseColumn;
  value: any;
  onClick: () => void;
}

export const CellRenderer: React.FC<CellRendererProps> = ({ column, value, onClick }) => {
  const renderValue = () => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-gray-500 italic text-xs">Empty</span>;
    }

    switch (column.type) {
      case 'checkbox':
        return (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={value || false}
              readOnly
              className="w-4 h-4 pointer-events-none"
            />
          </div>
        );

      case 'number':
        return <span className="font-mono">{typeof value === 'number' ? value.toLocaleString() : value}</span>;

      case 'date':
        return <span>{value ? new Date(value).toLocaleDateString() : ''}</span>;

      case 'select':
        const colorMap: Record<string, string> = {
          'Todo': 'bg-gray-500/20 text-gray-400',
          'In Progress': 'bg-yellow-500/20 text-yellow-400',
          'Done': 'bg-green-500/20 text-green-400',
          'Complete': 'bg-green-500/20 text-green-400',
          'Upcoming': 'bg-blue-500/20 text-blue-400',
          'High': 'bg-red-500/20 text-red-400',
          'Medium': 'bg-yellow-500/20 text-yellow-400',
          'Low': 'bg-blue-500/20 text-blue-400',
        };
        const colorClass = colorMap[value] || 'bg-purple-500/20 text-purple-400';
        return (
          <span className={`px-2 py-0.5 rounded text-xs ${colorClass}`}>
            {value}
          </span>
        );

      case 'text':
      default:
        return <span className="truncate">{value}</span>;
    }
  };

  return (
    <div
      onClick={onClick}
      className="px-3 py-2 cursor-pointer hover:bg-[#161b22] transition-colors h-full flex items-center"
    >
      {renderValue()}
    </div>
  );
};
