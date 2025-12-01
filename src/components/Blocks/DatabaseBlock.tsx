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
      className="px-4 py-3 text-left text-xs font-medium text-[#8b949e] uppercase tracking-wider relative group backdrop-blur-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-move touch-none opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="w-3 h-3 text-white/20 hover:text-white/40" />
          </div>

          {/* Column Name + Sort */}
          <div
            onClick={() => onSort(column.id)}
            className="flex items-center gap-1.5 cursor-pointer hover:text-white/90 transition-colors"
          >
            <span className="text-white/60 text-[10px]">
              {column.type === 'text' && '📝'}
              {column.type === 'number' && '🔢'}
              {column.type === 'date' && '📅'}
              {column.type === 'select' && '📋'}
              {column.type === 'checkbox' && '☑️'}
            </span>
            <span className="font-medium">{column.name}</span>
            {sortColumn === column.id && (
              <span className="text-blue-400/80">
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
            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/10 rounded-lg transition-all"
          >
            <MoreVertical className="w-3 h-3 text-white/40" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => onMenuClick('')}
              />
              <div 
                className="absolute right-0 top-full mt-2 py-1.5 min-w-[140px] z-50 rounded-xl overflow-hidden"
                style={{
                  background: 'rgba(30, 35, 45, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
                }}
              >
                <button
                  onClick={() => {
                    const newName = prompt('Enter new column name:', column.name);
                    if (newName && newName.trim()) {
                      onRename(column.id, newName.trim());
                    }
                    onMenuClick('');
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 transition-colors flex items-center gap-2.5"
                >
                  <Edit2 className="w-3.5 h-3.5 text-white/50" />
                  <span>Rename</span>
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete column "${column.name}"?`)) {
                      onDelete(column.id);
                    }
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-400/90 hover:bg-red-500/10 transition-colors flex items-center gap-2.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
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

    // Apply filter
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
    <div className="database-block-glass rounded-2xl overflow-hidden">
      {/* Glassy Container */}
      <div 
        className="relative"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Subtle gradient overlay for depth */}
        <div 
          className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)',
          }}
        />

        {/* Header */}
        <div className="relative flex items-center justify-between px-5 py-4 border-b border-white/5">
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
              className="text-base font-medium bg-white/5 border border-white/20 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
              autoFocus
            />
          ) : (
            <div
              className="flex items-center gap-2 cursor-pointer group"
              onClick={() => setEditingTitle(true)}
            >
              <span className="text-base font-medium text-white/90">{data.title}</span>
              <Edit2 className="w-3.5 h-3.5 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}

          {/* View Selector */}
          <div className="flex items-center gap-2">
            <select
              className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white/80 focus:outline-none focus:border-white/20 cursor-pointer hover:bg-white/10 transition-colors appearance-none pr-8"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.5)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
              }}
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
          <div className="relative px-5 py-3 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Search rows..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full pl-10 pr-10 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all"
              />
              {filterText && (
                <button
                  onClick={() => setFilterText('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-white/40" />
                </button>
              )}
            </div>
            {filterText && (
              <div className="mt-2 text-xs text-white/40">
                Showing {filteredAndSortedRows.length} of {data.rows.length} rows
              </div>
            )}
          </div>
        )}

      {/* Table View */}
      {data.view === 'table' && (
        <div className="relative overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleColumnDragEnd}
          >
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/5">
                  {/* Row Actions Column */}
                  <th className="w-12 bg-white/[0.02]"></th>

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
                  <th className="px-4 py-3 bg-white/[0.02]">
                    {!showAddColumnForm ? (
                      <button
                        onClick={() => setShowAddColumnForm(true)}
                        className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors group"
                      >
                        <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-200" />
                        <span>Add</span>
                      </button>
                    ) : (
                      <div 
                        className="flex flex-col gap-2 min-w-[160px] p-3 -m-3 rounded-xl"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          backdropFilter: 'blur(10px)',
                        }}
                      >
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
                          className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-white/30 transition-colors"
                          autoFocus
                        />
                        <select
                          value={newColumnType}
                          onChange={(e) => setNewColumnType(e.target.value as any)}
                          className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none cursor-pointer"
                        >
                          <option value="text">📝 Text</option>
                          <option value="number">🔢 Number</option>
                          <option value="date">📅 Date</option>
                          <option value="select">📋 Select</option>
                          <option value="checkbox">☑️ Checkbox</option>
                        </select>
                        <div className="flex gap-1.5">
                          <button
                            onClick={handleAddColumn}
                            className="flex-1 px-3 py-1.5 bg-blue-500/80 hover:bg-blue-500 rounded-lg text-xs text-white font-medium transition-colors"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => {
                              setShowAddColumnForm(false);
                              setNewColumnName('');
                            }}
                            className="flex-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white/80 transition-colors"
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
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-all duration-150 group"
                  >
                    {/* Row Number & Delete */}
                    <td className="px-3 py-0 text-center text-xs text-white/20">
                      <div className="flex items-center justify-center gap-1">
                        <span className="tabular-nums">{rowIndex + 1}</span>
                        <button
                          onClick={() => handleDeleteRow(row.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded-lg transition-all"
                          title="Delete row"
                        >
                          <Trash2 className="w-3 h-3 text-red-400/80" />
                        </button>
                      </div>
                    </td>

                    {/* Cells */}
                    {data.columns.map((column) => (
                      <td
                        key={column.id}
                        className="border-r border-white/[0.03] p-0"
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
                  <td colSpan={data.columns.length + 2} className="py-3 px-4">
                    <button
                      onClick={handleAddRow}
                      className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors group"
                    >
                      <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-200" />
                      <span>Add Row</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </DndContext>

          {/* Empty State */}
          {filteredAndSortedRows.length === 0 && data.rows.length > 0 && (
            <div className="text-center py-12 text-white/40 text-sm">
              <div className="mb-3 text-2xl">🔍</div>
              <div className="mb-2">No matching rows</div>
              <button
                onClick={() => setFilterText('')}
                className="text-blue-400/80 hover:text-blue-400 transition-colors"
              >
                Clear filter
              </button>
            </div>
          )}

          {filteredAndSortedRows.length === 0 && data.rows.length === 0 && (
            <div className="text-center py-12 text-white/40 text-sm">
              <div className="mb-3 text-2xl">📊</div>
              <div className="mb-2">No rows yet</div>
              <button
                onClick={handleAddRow}
                className="text-blue-400/80 hover:text-blue-400 transition-colors"
              >
                Add your first row
              </button>
            </div>
          )}
        </div>
      )}

      {/* Gallery View */}
      {data.view === 'gallery' && (
        <div className="relative p-4">
          <GalleryView
            columns={data.columns}
            rows={filteredAndSortedRows}
            onEditCell={handleEditCell}
            onDeleteRow={handleDeleteRow}
            onAddRow={handleAddRow}
          />
        </div>
      )}

      {/* Calendar View */}
      {data.view === 'calendar' && (
        <div className="relative p-4">
          <CalendarView
            columns={data.columns}
            rows={data.rows}
            onEditCell={handleEditCell}
            onAddRow={handleAddRow}
          />
        </div>
      )}
      </div>
    </div>
  );
};

export default DatabaseBlock;
