import React from 'react';
import { Search } from 'lucide-react';

interface SidebarSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SidebarSearch: React.FC<SidebarSearchProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
}) => {
  return (
    <div className="relative">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0d1117] border border-gray-800 rounded-lg py-2 pl-9 pr-3 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-600">
        ⌘K
      </span>
    </div>
  );
};

export default SidebarSearch;
