import React, { useState, useEffect, useRef, KeyboardEvent, useMemo } from 'react';
import { useNotesStore } from '@/store';
import { ChevronRight } from 'lucide-react';

interface MentionItem {
    id: string;
    title: string;
    displayTitle: string;  // Full path like "Parent / Child"
    depth: number;
    parentId: string | null;
    icon: string;
}

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
    const [filteredItems, setFilteredItems] = useState<MentionItem[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    
    // Track the selected note from autocomplete (persists until submission)
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [selectedNoteTitle, setSelectedNoteTitle] = useState<string | null>(null);

    // Flatten the tree structure to get all notes including children
    const allNotes = useMemo(() => {
        const flat: typeof notes = [];
        const flatten = (noteList: typeof notes) => {
            for (const note of noteList) {
                flat.push(note);
                if (note.children && note.children.length > 0) {
                    flatten(note.children);
                }
            }
        };
        flatten(notes);
        return flat;
    }, [notes]);

    // Build hierarchical mention items with full paths
    const mentionItems = useMemo(() => {
        const items: MentionItem[] = [];
        const noteMap = new Map(allNotes.map(n => [n.id, n]));
        
        // Helper to get full path
        const getPath = (noteId: string): string[] => {
            const path: string[] = [];
            let current = noteMap.get(noteId);
            while (current) {
                path.unshift(current.title);
                current = current.parent_id ? noteMap.get(current.parent_id) : undefined;
            }
            return path;
        };
        
        // Helper to get depth
        const getDepth = (noteId: string): number => {
            let depth = 0;
            let current = noteMap.get(noteId);
            while (current?.parent_id) {
                depth++;
                current = noteMap.get(current.parent_id);
            }
            return depth;
        };
        
        // Sort notes: parents first, then children grouped under parents
        const sortedNotes = [...allNotes].sort((a, b) => {
            const pathA = getPath(a.id);
            const pathB = getPath(b.id);
            return pathA.join('/').localeCompare(pathB.join('/'));
        });
        
        for (const note of sortedNotes) {
            const path = getPath(note.id);
            const depth = getDepth(note.id);
            
            items.push({
                id: note.id,
                title: note.title,
                displayTitle: path.join(' / '),
                depth,
                parentId: note.parent_id,
                icon: note.icon || '📄',
            });
        }
        
        return items;
    }, [allNotes]);

    // Detect @ symbol and filter notes
    useEffect(() => {
        const cursorPos = textareaRef.current?.selectionStart || 0;
        const textBeforeCursor = value.substring(0, cursorPos);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex !== -1 && lastAtIndex === textBeforeCursor.length - 1) {
            // Just typed '@'
            setShowAutocomplete(true);
            setFilteredItems(mentionItems);
            setSelectedIndex(0);
        } else if (lastAtIndex !== -1 && textBeforeCursor.lastIndexOf(' ') < lastAtIndex) {
            // Still typing after '@'
            const query = textBeforeCursor.substring(lastAtIndex + 1).toLowerCase();

            const filtered = mentionItems.filter(item =>
                item.title.toLowerCase().includes(query) ||
                item.displayTitle.toLowerCase().includes(query)
            );
            setFilteredItems(filtered);
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
    }, [value, mentionItems, selectedNoteTitle]);

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (showAutocomplete) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < filteredItems.length - 1 ? prev + 1 : prev
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
            } else if (e.key === 'Enter' && filteredItems.length > 0) {
                e.preventDefault();
                selectItem(filteredItems[selectedIndex]);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setShowAutocomplete(false);
            }
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const selectItem = (item: MentionItem) => {
        const cursorPos = textareaRef.current?.selectionStart || 0;
        const textBeforeCursor = value.substring(0, cursorPos);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        // Use displayTitle for sub-pages (shows full path)
        const mentionText = item.depth > 0 ? item.displayTitle : item.title;
        
        const newValue =
            value.substring(0, lastAtIndex + 1) +
            mentionText +
            ' ' +
            value.substring(cursorPos);

        onChange(newValue);
        setShowAutocomplete(false);
        
        // Store the selected note for submission
        setSelectedNoteId(item.id);
        setSelectedNoteTitle(mentionText);
        console.log(`📌 Note selected from autocomplete: "${mentionText}" (${item.id})`);

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
            // Priority 2: Try to match @mention with full path or title
            // Match @<anything until end of mention> - handles paths like "Parent / Child"
            const mentionRegex = /@([^@\n]+?)(?=\s+[a-z]|\s*$)/i;
            const mentionMatch = value.match(mentionRegex);
            
            if (mentionMatch) {
                const mentionedPath = mentionMatch[1].trim();
                console.log(`🔍 Looking for note with path/title: "${mentionedPath}"`);
                
                // Try to find by full path first (for sub-pages)
                let foundItem = mentionItems.find(item =>
                    item.displayTitle.toLowerCase() === mentionedPath.toLowerCase()
                );
                
                // Try exact title match
                if (!foundItem) {
                    foundItem = mentionItems.find(item =>
                        item.title.toLowerCase() === mentionedPath.toLowerCase()
                    );
                }
                
                // Try partial match (title starts with mention)
                if (!foundItem) {
                    foundItem = mentionItems.find(item =>
                        item.title.toLowerCase().startsWith(mentionedPath.toLowerCase()) ||
                        item.displayTitle.toLowerCase().startsWith(mentionedPath.toLowerCase())
                    );
                }
                
                // Try if mention contains note title
                if (!foundItem) {
                    foundItem = mentionItems.find(item =>
                        mentionedPath.toLowerCase().includes(item.title.toLowerCase())
                    );
                }
                
                mentionedNoteId = foundItem?.id;
                if (foundItem) {
                    console.log(`✅ Found note by regex: "${foundItem.displayTitle}" (${foundItem.id})`);
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
            {showAutocomplete && filteredItems.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 w-full max-w-[350px] bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden z-50 max-h-[300px] overflow-y-auto">
                    {filteredItems.map((item, index) => (
                        <button
                            key={item.id}
                            onClick={() => selectItem(item)}
                            className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2 ${index === selectedIndex
                                    ? 'bg-[#1f6feb]/20 text-[#58a6ff]'
                                    : 'text-[#e6edf3] hover:bg-[#1c2128]'
                                }`}
                            style={{ paddingLeft: `${16 + item.depth * 16}px` }}
                        >
                            <span className="flex-shrink-0">{item.icon}</span>
                            <span className="flex-1 truncate">
                                {item.depth > 0 ? (
                                    <span className="flex items-center gap-1">
                                        <span className="text-[#7d8590] text-xs">
                                            {item.displayTitle.split(' / ').slice(0, -1).join(' / ')}
                                        </span>
                                        <ChevronRight className="w-3 h-3 text-[#7d8590]" />
                                        <span>{item.title}</span>
                                    </span>
                                ) : (
                                    item.title
                                )}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NoteMentionInput;
