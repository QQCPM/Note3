import React, { useState } from 'react';
import { Plus, Trash2, Edit2, GripVertical, MoreVertical } from 'lucide-react';
import { updateBlock } from '@/utils/tauri';
import { useBlocksStore } from '@/store';
import type { Block, DatabaseBlockData, DatabaseColumn, DatabaseRowData } from '@/types';
import {
  TextCellEditor,
  NumberCellEditor,
  DateCellEditor,
  SelectCellEditor,
  CheckboxCellEditor,
  CellRenderer,
} from './Database/CellEditors';
import {
  createEmptyRow,
  updateCellValue,
  deleteRow,
  createColumn,
  deleteColumn as deleteColumnUtil,
  updateColumn as updateColumnUtil,
} from './Database/DatabaseUtils';

interface DatabaseBlockProps {
  block: Block;
}

const DatabaseBlock: React.FC<DatabaseBlockProps> = ({ block }) => {
  const { updateBlock: updateBlockInStore } = useBlocksStore();
  const data = block.data as DatabaseBlockData;

  // Local state for editing
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null);
  const [showColumnMenu, setShowColumnMenu] = useState<string | null>(null);
  const [showAddColumnForm, setShowAddColumnForm] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState<DatabaseColumn['type']>('text');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(data.title);

  // Save database changes to backend
  const saveDatabase = async (updates: Partial<DatabaseBlockData>) => {
    try {
      const newData: DatabaseBlockData = { ...data, ...updates };
      const updated = await updateBlock(block.id, newData);
      updateBlockInStore(block.id, updated);
    } catch (error) {
      console.error('Failed to update database:', error);
    }
  };

  // ========================================
  // ROW OPERATIONS
  // ========================================

  const handleAddRow = async () => {
    const newRow = createEmptyRow(data.columns);
    await saveDatabase({
      rows: [...data.rows, newRow],
    });
  };

  const handleDeleteRow = async (rowId: string) => {
    const newRows = deleteRow(data.rows, rowId);
    await saveDatabase({
      rows: newRows,
    });
  };

  const handleCellEdit = (rowId: string, columnId: string, value: any) => {
    const rowIndex = data.rows.findIndex(r => r.id === rowId);
    if (rowIndex === -1) return;

    const updatedRow = updateCellValue(data.rows[rowIndex], columnId, value);
    const newRows = [...data.rows];
    newRows[rowIndex] = updatedRow;

    saveDatabase({ rows: newRows });
    setEditingCell(null);
  };

  // ========================================
  // COLUMN OPERATIONS
  // ========================================

  const handleAddColumn = async () => {
    if (!newColumnName.trim()) return;

    const newColumn = createColumn(newColumnName, newColumnType);

    // Initialize the new column in all existing rows
    const updatedRows = data.rows.map(row => ({
      ...row,
      data: {
        ...row.data,
        [newColumn.id]: newColumnType === 'checkbox' ? false :
                        newColumnType === 'number' ? null : '',
      },
    }));

    await saveDatabase({
      columns: [...data.columns, newColumn],
      rows: updatedRows,
    });

    setNewColumnName('');
    setNewColumnType('text');
    setShowAddColumnForm(false);
  };

  const handleDeleteColumn = async (columnId: string) => {
    const { columns: newColumns, rows: newRows } = deleteColumnUtil(
      data.columns,
      data.rows,
      columnId
    );

    await saveDatabase({
      columns: newColumns,
      rows: newRows,
    });

    setShowColumnMenu(null);
  };

  const handleRenameColumn = async (columnId: string, newName: string) => {
    const newColumns = updateColumnUtil(data.columns, columnId, { name: newName });
    await saveDatabase({ columns: newColumns });
  };

  // ========================================
  // TITLE OPERATIONS
  // ========================================

  const handleTitleSave = async () => {
    if (titleValue.trim() !== data.title) {
      await saveDatabase({ title: titleValue.trim() });
    }
    setEditingTitle(false);
  };

  // ========================================
  // RENDER CELL
  // ========================================

  const renderCell = (row: DatabaseRowData, column: DatabaseColumn) => {
    const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === column.id;
    const value = row.data[column.id];

    if (isEditing) {
      const onSave = (newValue: any) => handleCellEdit(row.id, column.id, newValue);
      const onCancel = () => setEditingCell(null);

      switch (column.type) {
        case 'text':
          return <TextCellEditor value={value} onSave={onSave} onCancel={onCancel} />;
        case 'number':
          return <NumberCellEditor value={value} onSave={onSave} onCancel={onCancel} />;
        case 'date':
          return <DateCellEditor value={value} onSave={onSave} onCancel={onCancel} />;
        case 'select':
          return <SelectCellEditor value={value} column={column} onSave={onSave} onCancel={onCancel} />;
        case 'checkbox':
          return <CheckboxCellEditor value={value} onSave={onSave} />;
        default:
          return <TextCellEditor value={value} onSave={onSave} onCancel={onCancel} />;
      }
    }

    // Checkbox is always editable (no explicit edit mode)
    if (column.type === 'checkbox') {
      return (
        <CheckboxCellEditor
          value={value}
          onSave={(newValue) => handleCellEdit(row.id, column.id, newValue)}
        />
      );
    }

    return (
      <CellRenderer
        column={column}
        value={value}
        onClick={() => setEditingCell({ rowId: row.id, columnId: column.id })}
      />
    );
  };

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="canvas-block database-block">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        {/* Title */}
        {editingTitle ? (
          <input
            type="text"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSave();
              if (e.key === 'Escape') {
                setTitleValue(data.title);
                setEditingTitle(false);
              }
            }}
            className="text-sm font-semibold bg-[#0d1117] border border-blue-500 rounded px-2 py-1 text-white focus:outline-none"
            autoFocus
          />
        ) : (
          <div
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => setEditingTitle(true)}
          >
            <span className="text-sm font-semibold text-white">{data.title}</span>
            <Edit2 className="w-3 h-3 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}

        {/* View Selector (Future: Gallery/Calendar) */}
        <div className="flex items-center gap-2">
          <select
            className="px-2 py-1 bg-[#0d1117] border border-[#30363d] rounded text-xs text-white"
            value={data.view}
            onChange={(e) => saveDatabase({ view: e.target.value as any })}
          >
            <option value="table">📊 Table</option>
            <option value="gallery">🎨 Gallery</option>
            <option value="calendar">📅 Calendar</option>
          </select>
        </div>
      </div>

      {/* Table View */}
      {data.view === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#30363d]">
                {/* Row Actions Column */}
                <th className="w-12"></th>

                {/* Column Headers */}
                {data.columns.map((column) => (
                  <th
                    key={column.id}
                    className="px-3 py-2 text-left text-xs font-semibold text-gray-400 bg-[#161b22] relative group"
                    style={{ minWidth: column.width || 150 }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <GripVertical className="w-3 h-3 text-gray-600 cursor-move" />
                        <span>{column.name}</span>
                        <span className="text-[10px] text-gray-600 ml-1">
                          {column.type === 'text' && '📝'}
                          {column.type === 'number' && '🔢'}
                          {column.type === 'date' && '📅'}
                          {column.type === 'select' && '📋'}
                          {column.type === 'checkbox' && '☑️'}
                        </span>
                      </div>

                      {/* Column Menu */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowColumnMenu(showColumnMenu === column.id ? null : column.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#21262d] rounded transition-opacity"
                        >
                          <MoreVertical className="w-3 h-3" />
                        </button>

                        {showColumnMenu === column.id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setShowColumnMenu(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 bg-[#161b22] border border-[#30363d] rounded shadow-lg py-1 min-w-[150px] z-50">
                              <button
                                onClick={() => {
                                  const newName = prompt('Enter new column name:', column.name);
                                  if (newName && newName.trim()) {
                                    handleRenameColumn(column.id, newName.trim());
                                  }
                                  setShowColumnMenu(null);
                                }}
                                className="w-full px-3 py-1.5 text-left text-sm text-white hover:bg-[#21262d] transition-colors flex items-center gap-2"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Rename</span>
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete column "${column.name}"?`)) {
                                    handleDeleteColumn(column.id);
                                  }
                                }}
                                className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-[#21262d] transition-colors flex items-center gap-2"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </th>
                ))}

                {/* Add Column Button */}
                <th className="px-3 py-2 bg-[#161b22]">
                  {!showAddColumnForm ? (
                    <button
                      onClick={() => setShowAddColumnForm(true)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2 min-w-[150px]">
                      <input
                        type="text"
                        placeholder="Column name"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddColumn();
                          if (e.key === 'Escape') {
                            setShowAddColumnForm(false);
                            setNewColumnName('');
                          }
                        }}
                        className="px-2 py-1 bg-[#0d1117] border border-[#30363d] rounded text-xs text-white focus:outline-none focus:border-blue-500"
                        autoFocus
                      />
                      <select
                        value={newColumnType}
                        onChange={(e) => setNewColumnType(e.target.value as any)}
                        className="px-2 py-1 bg-[#0d1117] border border-[#30363d] rounded text-xs text-white focus:outline-none"
                      >
                        <option value="text">📝 Text</option>
                        <option value="number">🔢 Number</option>
                        <option value="date">📅 Date</option>
                        <option value="select">📋 Select</option>
                        <option value="checkbox">☑️ Checkbox</option>
                      </select>
                      <div className="flex gap-1">
                        <button
                          onClick={handleAddColumn}
                          className="flex-1 px-2 py-1 bg-blue-500 hover:bg-blue-600 rounded text-xs text-white transition-colors"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setShowAddColumnForm(false);
                            setNewColumnName('');
                          }}
                          className="flex-1 px-2 py-1 bg-[#21262d] hover:bg-[#30363d] rounded text-xs text-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </th>
              </tr>
            </thead>

            <tbody>
              {data.rows.map((row, rowIndex) => (
                <tr
                  key={row.id}
                  className="border-b border-[#21262d] hover:bg-[#161b22]/50 transition-colors group"
                >
                  {/* Row Number & Delete */}
                  <td className="px-2 py-0 text-center text-xs text-gray-600">
                    <div className="flex items-center justify-center gap-1">
                      <span className="opacity-50">{rowIndex + 1}</span>
                      <button
                        onClick={() => handleDeleteRow(row.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                        title="Delete row"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  </td>

                  {/* Cells */}
                  {data.columns.map((column) => (
                    <td
                      key={column.id}
                      className="border-r border-[#21262d] p-0"
                      style={{ minWidth: column.width || 150 }}
                    >
                      {renderCell(row, column)}
                    </td>
                  ))}

                  {/* Empty cell for Add Column column */}
                  <td className="p-0"></td>
                </tr>
              ))}

              {/* Add Row Button */}
              <tr>
                <td colSpan={data.columns.length + 2} className="py-2 px-3">
                  <button
                    onClick={handleAddRow}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Row</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Empty State */}
          {data.rows.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              <div className="mb-2">📊 No rows yet</div>
              <button
                onClick={handleAddRow}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Add your first row
              </button>
            </div>
          )}
        </div>
      )}

      {/* Gallery View (Placeholder) */}
      {data.view === 'gallery' && (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-2">🎨</div>
          <div className="text-sm">Gallery view coming soon!</div>
          <div className="text-xs mt-1 text-gray-600">
            Switch to Table view to edit data
          </div>
        </div>
      )}

      {/* Calendar View (Placeholder) */}
      {data.view === 'calendar' && (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-2">📅</div>
          <div className="text-sm">Calendar view coming soon!</div>
          <div className="text-xs mt-1 text-gray-600">
            Switch to Table view to edit data
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseBlock;
