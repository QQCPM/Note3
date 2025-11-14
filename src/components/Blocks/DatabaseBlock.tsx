import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, GripVertical, MoreVertical, ArrowUp, ArrowDown, Search, X } from 'lucide-react';
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
  reorderColumns,
} from './Database/DatabaseUtils';
import GalleryView from './Database/GalleryView';
import CalendarView from './Database/CalendarView';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DatabaseBlockProps {
  block: Block;
}

// Sortable Column Header Component
interface SortableColumnHeaderProps {
  column: DatabaseColumn;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (columnId: string) => void;
  onMenuClick: (columnId: string) => void;
  onRename: (columnId: string, newName: string) => void;
  onDelete: (columnId: string) => void;
  showMenu: boolean;
}

const SortableColumnHeader: React.FC<SortableColumnHeaderProps> = ({
  column,
  sortColumn,
  sortDirection,
  onSort,
  onMenuClick,
  onRename,
  onDelete,
  showMenu,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <th
      ref={setNodeRef}
      style={{ ...style, minWidth: column.width || 150 }}
      className="px-3 py-2 text-left text-xs font-semibold text-gray-400 bg-[#161b22] relative group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-move touch-none"
          >
            <GripVertical className="w-3 h-3 text-gray-600 hover:text-gray-400" />
          </div>

          {/* Column Name + Sort */}
          <div
            onClick={() => onSort(column.id)}
            className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors"
          >
            <span>{column.name}</span>
            <span className="text-[10px] text-gray-600 ml-1">
              {column.type === 'text' && '📝'}
              {column.type === 'number' && '🔢'}
              {column.type === 'date' && '📅'}
              {column.type === 'select' && '📋'}
              {column.type === 'checkbox' && '☑️'}
            </span>
            {sortColumn === column.id && (
              <span className="text-blue-400">
                {sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              </span>
            )}
          </div>
        </div>

        {/* Column Menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMenuClick(column.id);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#21262d] rounded transition-opacity"
          >
            <MoreVertical className="w-3 h-3" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => onMenuClick('')}
              />
              <div className="absolute right-0 top-full mt-1 bg-[#161b22] border border-[#30363d] rounded shadow-lg py-1 min-w-[150px] z-50">
                <button
                  onClick={() => {
                    const newName = prompt('Enter new column name:', column.name);
                    if (newName && newName.trim()) {
                      onRename(column.id, newName.trim());
                    }
                    onMenuClick('');
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm text-white hover:bg-[#21262d] transition-colors flex items-center gap-2"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Rename</span>
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete column "${column.name}"?`)) {
                      onDelete(column.id);
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
  );
};

const DatabaseBlock: React.FC<DatabaseBlockProps> = ({ block }) => {
  const { updateBlock: updateBlockInStore } = useBlocksStore();
  const data = block.data as DatabaseBlockData;

  // Validate and fix data structure
  if (!data) {
    console.error('DatabaseBlock: block.data is undefined', block);
    return (
      <div className="canvas-block p-4 bg-red-500/10 border border-red-500/30 rounded">
        <p className="text-red-400">Error: Database block data is missing</p>
      </div>
    );
  }

  if (!data.rows) {
    console.warn('DatabaseBlock: rows array is missing, initializing empty array');
    data.rows = [];
  }
  if (!data.columns) {
    console.warn('DatabaseBlock: columns array is missing, initializing empty array');
    data.columns = [];
  }
  if (!data.title) {
    data.title = 'Untitled Database';
  }
  if (!data.view) {
    data.view = 'table';
  }

  // Ensure all rows have valid data objects
  data.rows = data.rows.map((row, index) => {
    if (!row) {
      console.error(`DatabaseBlock: row at index ${index} is null/undefined`);
      return { id: `temp-${index}`, data: {} };
    }
    if (!row.id) {
      console.warn(`DatabaseBlock: row at index ${index} missing id, generating one`);
      row.id = `temp-${Date.now()}-${index}`;
    }
    if (!row.data || typeof row.data !== 'object') {
      console.warn(`DatabaseBlock: row ${row.id} has invalid data, initializing empty object`);
      return { ...row, data: {} };
    }
    return row;
  });

  // Local state for editing
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null);
  const [showColumnMenu, setShowColumnMenu] = useState<string | null>(null);
  const [showAddColumnForm, setShowAddColumnForm] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState<DatabaseColumn['type']>('text');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(data.title);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filtering state
  const [filterText, setFilterText] = useState('');

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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

    const row = data.rows[rowIndex];
    // Ensure row.data exists
    if (!row.data || typeof row.data !== 'object') {
      console.error('Cannot edit cell: invalid row data structure', row);
      return;
    }

    const updatedRow = updateCellValue(row, columnId, value);
    const newRows = [...data.rows];
    newRows[rowIndex] = updatedRow;

    saveDatabase({ rows: newRows });
    setEditingCell(null);
  };

  const handleEditCell = (rowId: string, columnId: string) => {
    setEditingCell({ rowId, columnId });
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

  // Column drag-and-drop
  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = data.columns.findIndex((col) => col.id === active.id);
    const newIndex = data.columns.findIndex((col) => col.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reorderedColumns = reorderColumns(data.columns, oldIndex, newIndex);
    saveDatabase({ columns: reorderedColumns });
  };

  // ========================================
  // SORTING
  // ========================================

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  // ========================================
  // FILTERING & SORTING (Computed)
  // ========================================

  const filteredAndSortedRows = useMemo(() => {
    // Filter out invalid rows
    let processedRows = data.rows.filter(row => row && row.data && typeof row.data === 'object');

    // Apply text filter
    if (filterText.trim()) {
      const lowerQuery = filterText.toLowerCase();
      processedRows = processedRows.filter(row => {
        return data.columns.some(col => {
          const value = row.data[col.id];
          if (value === null || value === undefined) return false;
          return value.toString().toLowerCase().includes(lowerQuery);
        });
      });
    }

    // Apply sort
    if (sortColumn) {
      const column = data.columns.find(col => col.id === sortColumn);
      if (column) {
        processedRows.sort((a, b) => {
          const aValue = a.data[sortColumn];
          const bValue = b.data[sortColumn];

          // Handle null/undefined
          if (aValue === null || aValue === undefined) return 1;
          if (bValue === null || bValue === undefined) return -1;

          // Type-specific sorting
          if (column.type === 'number') {
            const diff = (Number(aValue) || 0) - (Number(bValue) || 0);
            return sortDirection === 'asc' ? diff : -diff;
          } else if (column.type === 'date') {
            const aDate = new Date(aValue).getTime();
            const bDate = new Date(bValue).getTime();
            const diff = aDate - bDate;
            return sortDirection === 'asc' ? diff : -diff;
          } else if (column.type === 'checkbox') {
            const diff = (aValue ? 1 : 0) - (bValue ? 1 : 0);
            return sortDirection === 'asc' ? diff : -diff;
          } else {
            // Text/select - string comparison
            const diff = String(aValue).localeCompare(String(bValue));
            return sortDirection === 'asc' ? diff : -diff;
          }
        });
      }
    }

    return processedRows;
  }, [data.rows, data.columns, filterText, sortColumn, sortDirection]);

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
    // Defensive check: ensure row.data exists and is an object
    if (!row.data || typeof row.data !== 'object') {
      console.error('Invalid row data structure:', row);
      return <div className="px-3 py-2 text-xs text-red-400">Invalid data</div>;
    }
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

        {/* View Selector */}
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

      {/* Filter Bar (Table View Only) */}
      {data.view === 'table' && (
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Filter rows..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-[#0d1117] border border-[#30363d] rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
            {filterText && (
              <button
                onClick={() => setFilterText('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-[#161b22] rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>
          {filterText && (
            <div className="mt-2 text-xs text-gray-500">
              Showing {filteredAndSortedRows.length} of {data.rows.length} rows
            </div>
          )}
        </div>
      )}

      {/* Table View */}
      {data.view === 'table' && (
        <div className="overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleColumnDragEnd}
          >
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#30363d]">
                  {/* Row Actions Column */}
                  <th className="w-12"></th>

                  {/* Column Headers (Sortable & Draggable) */}
                  <SortableContext
                    items={data.columns.map((c) => c.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {data.columns.map((column) => (
                      <SortableColumnHeader
                        key={column.id}
                        column={column}
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        onMenuClick={(id) => setShowColumnMenu(showColumnMenu === id ? null : id)}
                        onRename={handleRenameColumn}
                        onDelete={handleDeleteColumn}
                        showMenu={showColumnMenu === column.id}
                      />
                    ))}
                  </SortableContext>

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
                {filteredAndSortedRows.map((row, rowIndex) => (
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
          </DndContext>

          {/* Empty State */}
          {filteredAndSortedRows.length === 0 && data.rows.length > 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              <div className="mb-2">🔍 No matching rows</div>
              <button
                onClick={() => setFilterText('')}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Clear filter
              </button>
            </div>
          )}

          {filteredAndSortedRows.length === 0 && data.rows.length === 0 && (
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

      {/* Gallery View */}
      {data.view === 'gallery' && (
        <GalleryView
          columns={data.columns}
          rows={filteredAndSortedRows}
          onEditCell={handleEditCell}
          onDeleteRow={handleDeleteRow}
          onAddRow={handleAddRow}
        />
      )}

      {/* Calendar View */}
      {data.view === 'calendar' && (
        <CalendarView
          columns={data.columns}
          rows={data.rows}
          onEditCell={handleEditCell}
          onAddRow={handleAddRow}
        />
      )}
    </div>
  );
};

export default DatabaseBlock;
