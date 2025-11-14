import React from 'react';
import type { DatabaseColumn, DatabaseRowData } from '@/types';
import { Edit2, Trash2 } from 'lucide-react';

interface GalleryViewProps {
  columns: DatabaseColumn[];
  rows: DatabaseRowData[];
  onEditCell: (rowId: string, columnId: string) => void;
  onDeleteRow: (rowId: string) => void;
  onAddRow: () => void;
}

const GalleryView: React.FC<GalleryViewProps> = ({
  columns,
  rows,
  onEditCell,
  onDeleteRow,
  onAddRow,
}) => {
  // Render value based on column type
  const renderValue = (column: DatabaseColumn, value: any) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-gray-600 italic text-xs">Empty</span>;
    }

    switch (column.type) {
      case 'checkbox':
        return (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value || false}
              readOnly
              className="w-4 h-4 pointer-events-none"
            />
            <span className="text-sm">{value ? 'Yes' : 'No'}</span>
          </div>
        );

      case 'number':
        return (
          <span className="font-mono text-blue-400">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
        );

      case 'date':
        return (
          <span className="text-purple-400">
            {value ? new Date(value).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            }) : ''}
          </span>
        );

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
          <span className={`px-2 py-1 rounded text-sm ${colorClass}`}>
            {value}
          </span>
        );

      case 'text':
      default:
        return <span className="text-gray-200">{value}</span>;
    }
  };

  // Get the first text column as title (or first column)
  const getTitleColumn = () => {
    const textColumn = columns.find(col => col.type === 'text');
    return textColumn || columns[0];
  };

  const titleColumn = getTitleColumn();

  return (
    <div className="gallery-view">
      {/* Gallery Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
        {rows.map((row) => {
          const titleValue = titleColumn ? row.data[titleColumn.id] : null;

          return (
            <div
              key={row.id}
              className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 hover:border-blue-500/50 transition-all group relative"
            >
              {/* Delete Button */}
              <button
                onClick={() => onDeleteRow(row.id)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 bg-red-500/20 hover:bg-red-500/30 rounded transition-all"
                title="Delete card"
              >
                <Trash2 className="w-3 h-3 text-red-400" />
              </button>

              {/* Card Title */}
              <div className="mb-3 pr-8">
                <div
                  onClick={() => titleColumn && onEditCell(row.id, titleColumn.id)}
                  className="text-sm font-semibold text-white cursor-pointer hover:text-blue-400 transition-colors"
                >
                  {titleValue || <span className="text-gray-600 italic">Untitled</span>}
                </div>
              </div>

              {/* Card Fields */}
              <div className="space-y-2">
                {columns
                  .filter(col => col.id !== titleColumn?.id) // Don't show title column again
                  .map((column) => {
                    const value = row.data[column.id];

                    return (
                      <div
                        key={column.id}
                        onClick={() => onEditCell(row.id, column.id)}
                        className="cursor-pointer hover:bg-[#161b22] rounded p-2 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-shrink-0">
                            <span className="text-xs text-gray-500 font-medium">
                              {column.name}
                            </span>
                          </div>
                          <div className="flex-1 text-right">
                            {renderValue(column, value)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Edit All Button */}
              <button
                onClick={() => titleColumn && onEditCell(row.id, titleColumn.id)}
                className="mt-3 w-full py-1.5 bg-[#161b22] hover:bg-[#21262d] rounded text-xs text-gray-400 hover:text-white transition-all flex items-center justify-center gap-1"
              >
                <Edit2 className="w-3 h-3" />
                <span>Edit Card</span>
              </button>
            </div>
          );
        })}

        {/* Add New Card */}
        <button
          onClick={onAddRow}
          className="bg-[#0d1117] border border-dashed border-[#30363d] rounded-lg p-4 hover:border-blue-500/50 hover:bg-[#161b22] transition-all min-h-[200px] flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-blue-400"
        >
          <div className="text-3xl">+</div>
          <div className="text-sm">Add New Card</div>
        </button>
      </div>

      {/* Empty State */}
      {rows.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-2">🎨</div>
          <div className="text-sm mb-2">No cards yet</div>
          <button
            onClick={onAddRow}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            Create your first card
          </button>
        </div>
      )}
    </div>
  );
};

export default GalleryView;
