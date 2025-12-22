import React, { useState, useRef, KeyboardEvent, useCallback } from 'react';
import { useNotesStore } from '@/store';
import { useRootNodeStore } from '@/store/rootNodeStore';
import { ArrowUp, BookMarked } from 'lucide-react';
import type { RootNode } from '@/types/rootNode';
import './ChatInput.css';

interface MentionItem {
  type: 'note' | 'root_node';
  id: string;
  title: string;
  icon: string;
  rootNode?: RootNode;
}

interface ChatInputProps {
  onSubmit: (input: string) => void;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSubmit, disabled = false }) => {
  const [input, setInput] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [filteredItems, setFilteredItems] = useState<MentionItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { notes } = useNotesStore();
  const { searchRootNodes } = useRootNodeStore();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const flattenNotes = useCallback((notesList: any[]): MentionItem[] => {
    const flat: MentionItem[] = [];
    const traverse = (items: any[]) => {
      items.forEach((item) => {
        flat.push({
          type: 'note',
          id: item.id,
          title: item.title,
          icon: item.icon || '📄',
        });
        if (item.children) {
          traverse(item.children);
        }
      });
    };
    traverse(notesList);
    return flat;
  }, []);

  const handleInputChange = async (value: string) => {
    setInput(value);

    // Detect @mention
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1 && textBeforeCursor.lastIndexOf(' ') < lastAtIndex) {
      // User is typing after '@'
      const query = textBeforeCursor.substring(lastAtIndex + 1).toLowerCase();

      // Search notes
      const flatNotes = flattenNotes(notes);
      const filteredNotes = flatNotes.filter((item) =>
        item.title.toLowerCase().includes(query)
      );

      // Search root nodes
      let rootNodeItems: MentionItem[] = [];
      try {
        const rootNodes = await searchRootNodes(query);
        rootNodeItems = rootNodes.map((node) => ({
          type: 'root_node' as const,
          id: node.id,
          title: node.term,
          icon: '📌',
          rootNode: node,
        }));
      } catch (error) {
        console.error('Failed to search root nodes:', error);
      }

      // Combine: root nodes first, then notes
      const combined = [...rootNodeItems, ...filteredNotes].slice(0, 10);

      setFilteredItems(combined);
      setShowMentionDropdown(combined.length > 0);
      setSelectedIndex(0);
    } else {
      setShowMentionDropdown(false);
    }
  };

  const selectItem = (item: MentionItem) => {
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = input.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    const newValue =
      input.substring(0, lastAtIndex + 1) +
      item.title +
      ' ' +
      input.substring(cursorPos);

    setInput(newValue);
    setShowMentionDropdown(false);

    // Focus back on input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionDropdown) {
      // Handle dropdown navigation
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredItems.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter' && filteredItems.length > 0) {
        e.preventDefault();
        selectItem(filteredItems[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionDropdown(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // Submit on Enter (without Shift)
      e.preventDefault();
      handleSubmit();
    }
    // Shift+Enter creates new line (default behavior)
  };

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;

    onSubmit(input);
    setInput('');
    setShowMentionDropdown(false);
  };

  return (
    <div className="chat-input-container">
      {/* Mention Dropdown */}
      {showMentionDropdown && filteredItems.length > 0 && (
        <div className="mention-dropdown">
          {filteredItems.map((item, idx) => (
            <button
              key={`${item.type}-${item.id}`}
              onClick={() => selectItem(item)}
              className={`mention-item ${idx === selectedIndex ? 'selected' : ''}`}
            >
              {item.type === 'root_node' ? (
                <BookMarked className="mention-icon definition-icon" size={14} />
              ) : (
                <span className="note-icon">{item.icon}</span>
              )}
              <span className="note-title">{item.title}</span>
              {item.type === 'root_node' && (
                <span className="mention-type-badge">Definition</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="input-form">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask anything, or @mention a note or definition..."
          className="input-field"
          rows={1}
        />
        <button
          type="submit"
          disabled={!input.trim() || disabled}
          className="submit-button"
        >
          <ArrowUp size={18} />
        </button>
      </form>

      {/* Helper text */}
      <div className="input-helper">
        <span className="helper-text">
          Type <code>@</code> to mention a note or definition • <code>Enter</code> to send • <code>Shift+Enter</code> for new line
        </span>
      </div>
    </div>
  );
};

export default ChatInput;
