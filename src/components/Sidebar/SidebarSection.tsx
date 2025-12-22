import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface SidebarSectionProps {
  title: string;
  icon?: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  count?: number;
  rightContent?: React.ReactNode;
  children: React.ReactNode;
}

const SidebarSection: React.FC<SidebarSectionProps> = ({
  title,
  icon,
  isExpanded,
  onToggle,
  count,
  rightContent,
  children,
}) => {
  return (
    <div>
      {/* Section Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[#161b22] rounded-md group"
        onClick={onToggle}
      >
        <span className="text-gray-500 transition-transform duration-200">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        
        {icon && <span className="text-gray-500">{icon}</span>}
        
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex-1">
          {title}
        </span>
        
        {count !== undefined && count > 0 && (
          <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
            {count}
          </span>
        )}
        
        {rightContent && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            {rightContent}
          </div>
        )}
      </div>

      {/* Section Content */}
      {isExpanded && (
        <div className="ml-2">
          {children}
        </div>
      )}
    </div>
  );
};

export default SidebarSection;
