import React, { useState, useEffect } from 'react';
import { updateBlock } from '@/utils/tauri';
import { useBlocksStore } from '@/store';
import type { Block } from '@/types';
import { nanoid } from 'nanoid';

interface DatabaseBlockProps {
  block: Block;
}

interface DatabaseColumn {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  options?: string[];
}

interface DatabaseRow {
  id: string;
  values: Record<string, any>;
}

interface DatabaseData {
  columns: DatabaseColumn[];
  rows: DatabaseRow[];
  view: 'table' | 'gallery' | 'calendar';
  title?: string;
}

const DatabaseBlock: React.FC<DatabaseBlockProps> = ({ block }) => {
  const { updateBlock: updateBlockInStore } = useBlocksStore();
  const [data, setData] = useState<DatabaseData>({
    columns: [],
    rows: [],
    view: 'table',
  });

  // Parse block data
  useEffect(() => {
    try {
      const parsed = JSON.parse(block.data);
      setData(parsed);
    } catch (error) {
      console.error('Failed to parse database block data:', error);
    }
  }, [block.data]);

  const saveData = async (newData: DatabaseData) => {
    try {
      const updated = await updateBlock(block.id, JSON.stringify(newData));
      updateBlockInStore(block.id, updated);
      setData(newData);
    } catch (error) {
      console.error('Failed to update database block:', error);
    }
  };

  const handleViewChange = (view: 'table' | 'gallery' | 'calendar') => {
    saveData({ ...data, view });
  };

  const handleCellChange = (rowId: string, columnId: string, value: any) => {
    const newRows = data.rows.map((row) =>
      row.id === rowId
        ? { ...row, values: { ...row.values, [columnId]: value } }
        : row
    );
    saveData({ ...data, rows: newRows });
  };

  const handleAddRow = () => {
    const newRow: DatabaseRow = {
      id: nanoid(),
      values: {},
    };
    data.columns.forEach((col) => {
      newRow.values[col.id] = col.type === 'checkbox' ? false : '';
    });
    saveData({ ...data, rows: [...data.rows, newRow] });
  };

  const handleDeleteRow = (rowId: string) => {
    const newRows = data.rows.filter((row) => row.id !== rowId);
    saveData({ ...data, rows: newRows });
  };

  return (
    <div className="canvas-block database-block">
      <div className="block-handle">⋮⋮</div>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-white">
          {data.title || 'Database'}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={data.view}
            onChange={(e) =>
              handleViewChange(e.target.value as 'table' | 'gallery' | 'calendar')
            }
            className="px-2 py-1 bg-[#0d1117] border border-[#30363d] rounded text-xs text-white outline-none"
          >
            <option value="table">Table</option>
            <option value="gallery">Gallery</option>
            <option value="calendar">Calendar</option>
          </select>
          <button className="text-xs text-gray-500 hover:text-white">•••</button>
        </div>
      </div>

      {/* Table View */}
      {data.view === 'table' && (
        <div className="database-view active" data-view="table">
          <table className="database-table">
            <thead>
              <tr>
                {data.columns.map((column) => (
                  <th key={column.id}>{column.name}</th>
                ))}
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id}>
                  {data.columns.map((column) => (
                    <td key={column.id}>
                      {column.type === 'select' ? (
                        <select
                          value={row.values[column.id] || ''}
                          onChange={(e) =>
                            handleCellChange(row.id, column.id, e.target.value)
                          }
                          className="bg-transparent border-none outline-none text-white w-full"
                        >
                          <option value="">-</option>
                          {column.options?.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : column.type === 'checkbox' ? (
                        <input
                          type="checkbox"
                          checked={row.values[column.id] || false}
                          onChange={(e) =>
                            handleCellChange(row.id, column.id, e.target.checked)
                          }
                          className="accent-blue-500"
                        />
                      ) : (
                        <input
                          type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'}
                          value={row.values[column.id] || ''}
                          onChange={(e) =>
                            handleCellChange(row.id, column.id, e.target.value)
                          }
                        />
                      )}
                    </td>
                  ))}
                  <td>
                    <button
                      onClick={() => handleDeleteRow(row.id)}
                      className="text-xs text-red-500 hover:text-red-400"
                      title="Delete row"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={handleAddRow}
            className="mt-2 text-xs text-gray-500 hover:text-white"
          >
            + Add row
          </button>
        </div>
      )}

      {/* Gallery View */}
      {data.view === 'gallery' && (
        <div className="database-view active" data-view="gallery">
          <div className="gallery-grid">
            {data.rows.map((row) => (
              <div key={row.id} className="gallery-card">
                <div className="gallery-card-title">
                  {row.values[data.columns[0]?.id] || 'Untitled'}
                </div>
                <div className="gallery-card-meta">
                  {data.columns.slice(1).map((column) => (
                    <div key={column.id}>
                      <strong>{column.name}:</strong>{' '}
                      {column.type === 'checkbox'
                        ? row.values[column.id]
                          ? '✓'
                          : '✗'
                        : row.values[column.id] || '-'}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleAddRow}
            className="mt-4 text-xs text-gray-500 hover:text-white"
          >
            + Add card
          </button>
        </div>
      )}

      {/* Calendar View */}
      {data.view === 'calendar' && (
        <div className="database-view active" data-view="calendar">
          <div className="text-xs text-gray-400 mb-2">
            {new Date().toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </div>
          <div className="calendar-grid">
            {/* Calendar headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="calendar-header">
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {Array.from({ length: 35 }, (_, i) => {
              const today = new Date();
              const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
              const startOffset = firstDay.getDay();
              const date = new Date(firstDay);
              date.setDate(date.getDate() - startOffset + i);
              const dateStr = date.toISOString().split('T')[0];

              // Find events for this date
              const dateColumn = data.columns.find((col) => col.type === 'date');
              const events = dateColumn
                ? data.rows.filter((row) => row.values[dateColumn.id] === dateStr)
                : [];

              const isCurrentMonth = date.getMonth() === today.getMonth();

              return (
                <div
                  key={i}
                  className="calendar-day"
                  style={{ opacity: isCurrentMonth ? 1 : 0.3 }}
                >
                  <div className="calendar-day-number">{date.getDate()}</div>
                  {events.map((event) => (
                    <div key={event.id} className="calendar-event">
                      {event.values[data.columns[0]?.id] || 'Event'}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseBlock;
