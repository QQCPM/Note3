import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useNotesStore } from '@/store';

interface NoteMentionInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (value: string, mentionedNoteId?: string) => void;
    disabled?: boolean;
}

const NoteMentionInput: React.FC<NoteMentionInputProps> = ({
    value,
    onChange,
    onSubmit,
    disabled = false
}) => {
    const { notes } = useNotesStore();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [filteredNotes, setFilteredNotes] = useState<typeof notes>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    
    // Track the selected note from autocomplete (persists until submission)
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [selectedNoteTitle, setSelectedNoteTitle] = useState<string | null>(null);

    // Detect @ symbol and filter notes
    useEffect(() => {
        const cursorPos = textareaRef.current?.selectionStart || 0;
        const textBeforeCursor = value.substring(0, cursorPos);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex !== -1 && lastAtIndex === textBeforeCursor.length - 1) {
            // Just typed '@'
            setShowAutocomplete(true);
            setFilteredNotes(notes);
            setSelectedIndex(0);
        } else if (lastAtIndex !== -1 && textBeforeCursor.lastIndexOf(' ') < lastAtIndex) {
            // Still typing after '@'
            const query = textBeforeCursor.substring(lastAtIndex + 1).toLowerCase();

            const filtered = notes.filter(note =>
                note.title.toLowerCase().includes(query)
            );
            setFilteredNotes(filtered);
            setSelectedIndex(0);
            setShowAutocomplete(filtered.length > 0);
        } else {
            // '@' deleted or space after mention
            setShowAutocomplete(false);
        }
        
        // Clear stored note if user deleted/modified the @mention
        if (selectedNoteTitle && !value.includes(`@${selectedNoteTitle}`)) {
            console.log('🔄 @mention modified, clearing stored note');
            setSelectedNoteId(null);
            setSelectedNoteTitle(null);
        }
    }, [value, notes, selectedNoteTitle]);

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (showAutocomplete) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < filteredNotes.length - 1 ? prev + 1 : prev
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
            } else if (e.key === 'Enter' && filteredNotes.length > 0) {
                e.preventDefault();
                selectNote(filteredNotes[selectedIndex]);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setShowAutocomplete(false);
            }
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const selectNote = (note: typeof notes[0]) => {
        const cursorPos = textareaRef.current?.selectionStart || 0;
        const textBeforeCursor = value.substring(0, cursorPos);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        const newValue =
            value.substring(0, lastAtIndex + 1) +
            note.title +
            ' ' +
            value.substring(cursorPos);

        onChange(newValue);
        setShowAutocomplete(false);
        
        // Store the selected note for submission
        setSelectedNoteId(note.id);
        setSelectedNoteTitle(note.title);
        console.log(`📌 Note selected from autocomplete: "${note.title}" (${note.id})`);

        // Focus back on textarea
        setTimeout(() => {
            textareaRef.current?.focus();
        }, 0);
    };

    const handleSubmit = () => {
        if (!value.trim()) return;

        let mentionedNoteId: string | undefined;

        // Priority 1: Use the note selected from autocomplete (most reliable)
        if (selectedNoteId && selectedNoteTitle && value.includes(`@${selectedNoteTitle}`)) {
            mentionedNoteId = selectedNoteId;
            console.log(`✅ Using autocomplete-selected note: "${selectedNoteTitle}" (${selectedNoteId})`);
        } else {
            // Priority 2: Try to match @mention with full title (including spaces)
            // Match @<anything until end of mention> - titles end at common delimiters or end of string
            const mentionRegex = /@([^@\n]+?)(?=\s+[a-z]|\s*$)/i;
            const mentionMatch = value.match(mentionRegex);
            
            if (mentionMatch) {
                const mentionedTitle = mentionMatch[1].trim();
                console.log(`🔍 Looking for note with title: "${mentionedTitle}"`);
                
                // Try exact match first
                let note = notes.find(n =>
                    n.title.toLowerCase() === mentionedTitle.toLowerCase()
                );
                
                // If no exact match, try partial match (title starts with mention)
                if (!note) {
                    note = notes.find(n =>
                        n.title.toLowerCase().startsWith(mentionedTitle.toLowerCase())
                    );
                }
                
                // If still no match, try if mention contains note title
                if (!note) {
                    note = notes.find(n =>
                        mentionedTitle.toLowerCase().includes(n.title.toLowerCase())
                    );
                }
                
                mentionedNoteId = note?.id;
                if (note) {
                    console.log(`✅ Found note by regex: "${note.title}" (${note.id})`);
                }
            }
        }

        // Clear selected note state after submission
        setSelectedNoteId(null);
        setSelectedNoteTitle(null);
        
        onSubmit(value, mentionedNoteId);
    };

    return (
        <div className="relative">
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                placeholder="Ask anything, or type '@' to add to a note..."
                className="w-full bg-transparent border-none outline-none text-[#e6edf3] text-sm placeholder-[#7d8590] resize-none min-h-[40px] px-2"
                autoFocus
            />

            {/* Autocomplete Dropdown */}
            {showAutocomplete && filteredNotes.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 w-full max-w-[300px] bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden z-50">
                    {filteredNotes.map((note, index) => (
                        <button
                            key={note.id}
                            onClick={() => selectNote(note)}
                            className={`w-full px-4 py-2 text-left text-sm transition-colors ${index === selectedIndex
                                    ? 'bg-[#1f6feb]/20 text-[#58a6ff]'
                                    : 'text-[#e6edf3] hover:bg-[#1c2128]'
                                }`}
                        >
                            {note.title}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NoteMentionInput;
