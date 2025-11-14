import React, { useState } from 'react';
import type { DatabaseColumn, DatabaseRowData } from '@/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarViewProps {
  columns: DatabaseColumn[];
  rows: DatabaseRowData[];
  onEditCell: (rowId: string, columnId: string) => void;
  onAddRow: () => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  columns,
  rows,
  onEditCell,
  onAddRow,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Find the first date column
  const dateColumn = columns.find(col => col.type === 'date');

  // Get title column (first text column or first column)
  const getTitleColumn = () => {
    const textColumn = columns.find(col => col.type === 'text');
    return textColumn || columns[0];
  };
  const titleColumn = getTitleColumn();

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = lastDayOfMonth.getDate();

  // Create calendar grid
  const calendarDays: (number | null)[] = [];

  // Add empty cells for days before the month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }

  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Get entries for a specific date
  const getEntriesForDate = (day: number) => {
    if (!dateColumn) return [];

    const targetDate = new Date(year, month, day);
    const targetDateString = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

    return rows.filter(row => {
      const rowDate = row.data[dateColumn.id];
      if (!rowDate) return false;

      const rowDateString = new Date(rowDate).toISOString().split('T')[0];
      return rowDateString === targetDateString;
    });
  };

  // Render entry badge
  const renderEntry = (row: DatabaseRowData) => {
    const title = titleColumn ? row.data[titleColumn.id] : 'Entry';

    return (
      <div
        key={row.id}
        onClick={() => titleColumn && onEditCell(row.id, titleColumn.id)}
        className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded truncate cursor-pointer hover:bg-blue-500/30 transition-colors"
        title={title}
      >
        {title || 'Untitled'}
      </div>
    );
  };

  // No date column available
  if (!dateColumn) {
    return (
      <div className="text-center py-12 text-gray-500">
        <div className="text-4xl mb-2">📅</div>
        <div className="text-sm mb-2">Calendar view requires a date column</div>
        <div className="text-xs text-gray-600">
          Add a date column to your database to use calendar view
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-view">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-[#161b22] rounded transition-colors"
            title="Previous month"
          >
            <ChevronLeft className="w-4 h-4 text-gray-400" />
          </button>

          <h3 className="text-sm font-semibold text-white min-w-[150px] text-center">
            {monthName}
          </h3>

          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-[#161b22] rounded transition-colors"
            title="Next month"
          >
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <button
          onClick={goToToday}
          className="px-3 py-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-xs transition-colors"
        >
          Today
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="text-center text-xs font-semibold text-gray-500 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((day, index) => {
          if (day === null) {
            return (
              <div
                key={`empty-${index}`}
                className="bg-[#0d1117] border border-[#21262d] rounded min-h-[100px] p-2"
              />
            );
          }

          const entries = getEntriesForDate(day);
          const isToday =
            day === new Date().getDate() &&
            month === new Date().getMonth() &&
            year === new Date().getFullYear();

          return (
            <div
              key={`day-${day}`}
              className={`bg-[#0d1117] border rounded min-h-[100px] p-2 transition-colors ${
                isToday
                  ? 'border-blue-500 bg-blue-500/5'
                  : 'border-[#21262d] hover:border-[#30363d]'
              }`}
            >
              {/* Day Number */}
              <div
                className={`text-xs font-semibold mb-2 ${
                  isToday ? 'text-blue-400' : 'text-gray-400'
                }`}
              >
                {day}
              </div>

              {/* Entries */}
              <div className="space-y-1">
                {entries.slice(0, 3).map(renderEntry)}
                {entries.length > 3 && (
                  <div className="text-xs text-gray-600 px-1.5">
                    +{entries.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <div>
          Total entries this month: {rows.filter(row => {
            const rowDate = row.data[dateColumn.id];
            if (!rowDate) return false;
            const date = new Date(rowDate);
            return date.getMonth() === month && date.getFullYear() === year;
          }).length}
        </div>

        <button
          onClick={onAddRow}
          className="text-blue-400 hover:text-blue-300 transition-colors"
        >
          + Add Entry
        </button>
      </div>

      {/* Empty State */}
      {rows.length === 0 && (
        <div className="text-center py-12 text-gray-500 absolute inset-0 flex flex-col items-center justify-center bg-[#0d1117]/95">
          <div className="text-4xl mb-2">📅</div>
          <div className="text-sm mb-2">No entries yet</div>
          <button
            onClick={onAddRow}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            Add your first entry
          </button>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
