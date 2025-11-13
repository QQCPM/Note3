import React, { useEffect, useRef, useState } from 'react';

interface SlashCommand {
  id: string;
  icon: string;
  iconGradient?: string;
  iconBg?: string;
  title: string;
  description: string;
  action: () => void;
  requiresAI?: boolean;
}

interface SlashCommandMenuProps {
  position: { x: number; y: number };
  onClose: () => void;
  onSelectCommand: (command: SlashCommand) => void;
  searchQuery?: string;
}

const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  position,
  onClose,
  onSelectCommand,
  searchQuery = '',
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Define all slash commands matching the HTML prototype
  const commands: SlashCommand[] = [
    {
      id: 'artifact',
      icon: '🎨',
      iconGradient: 'linear-gradient(135deg, #a371f7, #8a54e6)',
      title: 'Artifact',
      description: 'Create interactive HTML/CSS/JS',
      requiresAI: true,
      action: () => {},
    },
    {
      id: 'database',
      icon: '📊',
      iconGradient: 'linear-gradient(135deg, #58a6ff, #4493e8)',
      title: 'Database',
      description: 'Create a table or database',
      requiresAI: true,
      action: () => {},
    },
    {
      id: 'tasks',
      icon: '✅',
      iconGradient: 'linear-gradient(135deg, #3fb950, #2e8b40)',
      title: 'Task List',
      description: 'Create a list of tasks',
      action: () => {},
    },
    {
      id: 'heading1',
      icon: 'H1',
      iconBg: '#30363d',
      title: 'Heading 1',
      description: 'Large section heading',
      action: () => {},
    },
    {
      id: 'heading2',
      icon: 'H2',
      iconBg: '#30363d',
      title: 'Heading 2',
      description: 'Medium section heading',
      action: () => {},
    },
    {
      id: 'text',
      icon: 'T',
      iconBg: '#30363d',
      title: 'Text',
      description: 'Regular paragraph',
      action: () => {},
    },
  ];

  // Filter commands based on search query
  const filteredCommands = searchQuery
    ? commands.filter(
        (cmd) =>
          cmd.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cmd.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : commands;

  // Reset selected index when filtered commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          handleSelectCommand(filteredCommands[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, filteredCommands, onClose]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = menuRef.current?.children[selectedIndex] as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  const handleSelectCommand = (command: SlashCommand) => {
    onSelectCommand(command);
  };

  if (filteredCommands.length === 0) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="slash-menu show"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000,
      }}
    >
      {filteredCommands.map((command, index) => (
        <div
          key={command.id}
          className={`slash-menu-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => handleSelectCommand(command)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div
            className="slash-menu-icon"
            style={{
              background: command.iconGradient || command.iconBg,
            }}
          >
            {command.icon}
          </div>
          <div className="slash-menu-text">
            <div className="slash-menu-title">{command.title}</div>
            <div className="slash-menu-desc">{command.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SlashCommandMenu;
