import React, { useState } from 'react';
import { MoreHorizontal, Edit2, Trash2, Archive, Settings } from 'lucide-react';
import { Project } from '@/types/project';

// ============================================================================
// TYPES
// ============================================================================

interface ProjectHeaderProps {
  project: Project;
  onEdit?: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
  onSettings?: () => void;
}

// ============================================================================
// PROJECT HEADER COMPONENT
// ============================================================================

const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  project,
  onEdit,
  onDelete,
  onArchive,
  onSettings,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  // Get status badge color
  const getStatusBadgeClass = () => {
    switch (project.status) {
      case 'active':
        return 'bg-green-500/20 text-green-400';
      case 'paused':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'completed':
        return 'bg-blue-500/20 text-blue-400';
      case 'archived':
        return 'bg-gray-500/20 text-gray-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  // Get project type label
  const getTypeLabel = () => {
    switch (project.type) {
      case 'study':
        return 'Study Project';
      case 'roadmap':
        return 'Learning Roadmap';
      case 'general':
        return 'General Notes';
      default:
        return 'Project';
    }
  };

  return (
    <div className="px-3 py-3 border-b border-gray-800">
      {/* Header Row */}
      <div className="flex items-center gap-3">
        {/* Icon */}
        <span className="text-2xl">{project.icon}</span>

        {/* Title & Type */}
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-white truncate">
            {project.name}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">{getTypeLabel()}</span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${getStatusBadgeClass()}`}
            >
              {project.status}
            </span>
          </div>
        </div>

        {/* Menu Button */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
          >
            <MoreHorizontal size={16} />
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />

              {/* Menu */}
              <div className="absolute right-0 top-full mt-1 w-40 bg-[#161b22] border border-gray-700 rounded-lg shadow-lg z-50 py-1">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onEdit?.();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800"
                >
                  <Edit2 size={14} />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onSettings?.();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800"
                >
                  <Settings size={14} />
                  <span>Settings</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onArchive?.();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800"
                >
                  <Archive size={14} />
                  <span>Archive</span>
                </button>
                <div className="h-px bg-gray-700 my-1" />
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete?.();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Progress Bar (if applicable) */}
      {project.progress > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Progress</span>
            <span className="text-xs text-gray-400">{project.progress}%</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Description (if present) */}
      {project.description && (
        <p className="mt-2 text-xs text-gray-500 line-clamp-2">
          {project.description}
        </p>
      )}
    </div>
  );
};

export default ProjectHeader;
