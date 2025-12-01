import React, { useState, useRef, KeyboardEvent } from 'react';
import { useNotesStore } from '@/store';
import { ArrowUp } from 'lucide-react';
import './ChatInput.css';

interface ChatInputProps {
  onSubmit: (input: string) => void;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSubmit, disabled = false }) => {
  const [input, setInput] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [filteredNotes, setFilteredNotes] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { notes } = useNotesStore();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleInputChange = (value: string) => {
    setInput(value);

    // Detect @mention
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1 && textBeforeCursor.lastIndexOf(' ') < lastAtIndex) {
      // User is typing after '@'
      const query = textBeforeCursor.substring(lastAtIndex + 1).toLowerCase();

      // Flatten notes tree for search
      const flatNotes = flattenNotes(notes);
      const filtered = flatNotes.filter((note) =>
        note.title.toLowerCase().includes(query)
      );

      setFilteredNotes(filtered);
      setShowMentionDropdown(filtered.length > 0);
      setSelectedIndex(0);
    } else {
      setShowMentionDropdown(false);
    }
  };

  const flattenNotes = (notesList: any[]): any[] => {
    const flat: any[] = [];
    const traverse = (items: any[]) => {
      items.forEach((item) => {
        flat.push(item);
        if (item.children) {
          traverse(item.children);
        }
      });
    };
    traverse(notesList);
    return flat;
  };

  const selectNote = (note: any) => {
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = input.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    const newValue =
      input.substring(0, lastAtIndex + 1) +
      note.title +
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
          prev < filteredNotes.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter' && filteredNotes.length > 0) {
        e.preventDefault();
        selectNote(filteredNotes[selectedIndex]);
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
      {showMentionDropdown && filteredNotes.length > 0 && (
        <div className="mention-dropdown">
          {filteredNotes.map((note, idx) => (
            <button
              key={note.id}
              onClick={() => selectNote(note)}
              className={`mention-item ${idx === selectedIndex ? 'selected' : ''}`}
            >
              <span className="note-icon">{note.icon || '📄'}</span>
              <span className="note-title">{note.title}</span>
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
          placeholder="Ask anything, or @mention a note..."
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
          Type <code>@</code> to mention a note • <code>Enter</code> to send • <code>Shift+Enter</code> for new line
        </span>
      </div>
    </div>
  );
};

export default ChatInput;
