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
      className="w-full px-3 py-2 bg-white/5 border border-blue-500/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
      className="w-full px-3 py-2 bg-white/5 border border-blue-500/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-all tabular-nums"
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
      className="w-full px-3 py-2 bg-white/5 border border-blue-500/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
      className="w-full px-3 py-2 bg-white/5 border border-blue-500/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-400 cursor-pointer transition-all"
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
    <div className="flex items-center justify-center w-full h-full py-2">
      <button
        onClick={handleToggle}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150 ${
          value 
            ? 'bg-blue-500/80 border-blue-400/50 text-white' 
            : 'bg-white/5 border-white/20 hover:border-white/40'
        }`}
      >
        {value && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
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
      return <span className="text-white/20 italic text-xs">Empty</span>;
    }

    switch (column.type) {
      case 'checkbox':
        return (
          <div className="flex items-center justify-center">
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
              value 
                ? 'bg-blue-500/80 border-blue-400/50 text-white' 
                : 'bg-white/5 border-white/20'
            }`}>
              {value && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
        );

      case 'number':
        return <span className="font-mono text-white/80 tabular-nums">{typeof value === 'number' ? value.toLocaleString() : value}</span>;

      case 'date':
        return <span className="text-white/70">{value ? new Date(value).toLocaleDateString() : ''}</span>;

      case 'select':
        const colorMap: Record<string, string> = {
          'Todo': 'bg-white/10 text-white/60 border-white/10',
          'In Progress': 'bg-amber-500/15 text-amber-400/90 border-amber-500/20',
          'Done': 'bg-emerald-500/15 text-emerald-400/90 border-emerald-500/20',
          'Complete': 'bg-emerald-500/15 text-emerald-400/90 border-emerald-500/20',
          'Upcoming': 'bg-sky-500/15 text-sky-400/90 border-sky-500/20',
          'High': 'bg-rose-500/15 text-rose-400/90 border-rose-500/20',
          'Medium': 'bg-amber-500/15 text-amber-400/90 border-amber-500/20',
          'Low': 'bg-sky-500/15 text-sky-400/90 border-sky-500/20',
        };
        const colorClass = colorMap[value] || 'bg-violet-500/15 text-violet-400/90 border-violet-500/20';
        return (
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${colorClass}`}>
            {value}
          </span>
        );

      case 'text':
      default:
        return <span className="truncate text-white/80">{value}</span>;
    }
  };

  return (
    <div
      onClick={onClick}
      className="px-4 py-2.5 cursor-pointer hover:bg-white/[0.03] transition-colors h-full flex items-center text-sm"
    >
      {renderValue()}
    </div>
  );
};
