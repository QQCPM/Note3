import React, { useState, useEffect, useRef, KeyboardEvent, useMemo } from 'react';
import { useNotesStore } from '@/store';
import { useProjectStore } from '@/store/projectStore';
import { FileText, Folder, File, Video, Music, Image } from 'lucide-react';

interface MentionItem {
    id: string;
    title: string;
    displayTitle: string;  // Full path like "Parent / Child"
    depth: number;
    parentId: string | null;
    icon: string;
    type: 'note' | 'folder' | 'pdf' | 'video' | 'audio' | 'image' | 'file';
    source: 'notes' | 'project';  // Where this item comes from
}

interface NoteMentionInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (value: string, mentionedNoteId?: string) => void;
    disabled?: boolean;
}

// Helper to get icon component for file type
const getTypeIcon = (type: MentionItem['type']) => {
    switch (type) {
        case 'folder': return <Folder className="w-4 h-4 text-yellow-500" />;
        case 'pdf': return <FileText className="w-4 h-4 text-red-400" />;
        case 'video': return <Video className="w-4 h-4 text-purple-400" />;
        case 'audio': return <Music className="w-4 h-4 text-green-400" />;
        case 'image': return <Image className="w-4 h-4 text-blue-400" />;
        case 'note': return <FileText className="w-4 h-4 text-gray-400" />;
        default: return <File className="w-4 h-4 text-gray-400" />;
    }
};

const NoteMentionInput: React.FC<NoteMentionInputProps> = ({
    value,
    onChange,
    onSubmit,
    disabled = false
}) => {
    const { notes } = useNotesStore();
    const { treeItems, projects } = useProjectStore();
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

    // Build hierarchical mention items with full paths from both notes and project tree
    const mentionItems = useMemo(() => {
        const items: MentionItem[] = [];
        
        // === NOTES FROM NOTES STORE ===
        const noteMap = new Map(allNotes.map(n => [n.id, n]));
        
        const getNotePath = (noteId: string): string[] => {
            const path: string[] = [];
            let current = noteMap.get(noteId);
            while (current) {
                path.unshift(current.title);
                current = current.parent_id ? noteMap.get(current.parent_id) : undefined;
            }
            return path;
        };
        
        const getNoteDepth = (noteId: string): number => {
            let depth = 0;
            let current = noteMap.get(noteId);
            while (current?.parent_id) {
                depth++;
                current = noteMap.get(current.parent_id);
            }
            return depth;
        };
        
        const sortedNotes = [...allNotes].sort((a, b) => {
            const pathA = getNotePath(a.id);
            const pathB = getNotePath(b.id);
            return pathA.join('/').localeCompare(pathB.join('/'));
        });
        
        for (const note of sortedNotes) {
            const path = getNotePath(note.id);
            const depth = getNoteDepth(note.id);
            
            items.push({
                id: note.id,
                title: note.title,
                displayTitle: path.join(' / '),
                depth,
                parentId: note.parent_id,
                icon: note.icon || '📄',
                type: 'note',
                source: 'notes',
            });
        }
        
        // === ITEMS FROM PROJECT TREE ===
        const treeItemMap = new Map(treeItems.map(t => [t.id, t]));
        const projectMap = new Map(projects.map(p => [p.id, p]));
        
        const getTreePath = (itemId: string): string[] => {
            const path: string[] = [];
            let current = treeItemMap.get(itemId);
            while (current) {
                path.unshift(current.name);
                current = current.parentId ? treeItemMap.get(current.parentId) : undefined;
            }
            // Add project name at the start
            const firstItem = treeItemMap.get(itemId);
            if (firstItem) {
                const project = projectMap.get(firstItem.projectId);
                if (project) {
                    path.unshift(project.name);
                }
            }
            return path;
        };
        
        const getTreeDepth = (itemId: string): number => {
            let depth = 1; // Start at 1 because project is at depth 0
            let current = treeItemMap.get(itemId);
            while (current?.parentId) {
                depth++;
                current = treeItemMap.get(current.parentId);
            }
            return depth;
        };
        
        const mapTreeType = (type: string): MentionItem['type'] => {
            if (type === 'folder') return 'folder';
            if (type === 'pdf') return 'pdf';
            if (type === 'video') return 'video';
            if (type === 'audio') return 'audio';
            if (type === 'image') return 'image';
            if (type === 'note') return 'note';
            return 'file';
        };
        
        // Sort tree items by path
        const sortedTreeItems = [...treeItems].sort((a, b) => {
            const pathA = getTreePath(a.id);
            const pathB = getTreePath(b.id);
            return pathA.join('/').localeCompare(pathB.join('/'));
        });
        
        for (const item of sortedTreeItems) {
            const path = getTreePath(item.id);
            const depth = getTreeDepth(item.id);
            
            items.push({
                id: item.noteId || item.id, // Use noteId if available for notes
                title: item.name,
                displayTitle: path.join(' / '),
                depth,
                parentId: item.parentId,
                icon: item.type === 'folder' ? '📁' : item.type === 'pdf' ? '📕' : item.type === 'note' ? '📝' : '📄',
                type: mapTreeType(item.type),
                source: 'project',
            });
        }
        
        return items;
    }, [allNotes, treeItems, projects]);

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
            {showAutocomplete && (
                <div className="absolute bottom-full left-0 mb-2 w-full max-w-[400px] bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden z-50">
                    {/* Search hint header */}
                    <div className="px-3 py-2 border-b border-[#30363d] bg-[#0d1117]">
                        <span className="text-xs text-[#7d8590]">
                            Type to search notes and files...
                        </span>
                    </div>
                    
                    {/* Results list */}
                    <div className="max-h-[280px] overflow-y-auto">
                        {filteredItems.length > 0 ? (
                            filteredItems.slice(0, 20).map((item, index) => (
                                <button
                                    key={`${item.source}-${item.id}-${index}`}
                                    onClick={() => selectItem(item)}
                                    className={`w-full px-3 py-2.5 text-left text-sm transition-colors flex items-center gap-2.5 ${index === selectedIndex
                                            ? 'bg-[#1f6feb]/20 text-[#58a6ff]'
                                            : 'text-[#e6edf3] hover:bg-[#1c2128]'
                                        }`}
                                >
                                    {/* Type icon */}
                                    <span className="flex-shrink-0">
                                        {getTypeIcon(item.type)}
                                    </span>
                                    
                                    {/* Content */}
                                    <span className="flex-1 min-w-0">
                                        <span className="block truncate font-medium">{item.title}</span>
                                        {item.depth > 0 && (
                                            <span className="flex items-center gap-1 text-xs text-[#7d8590] truncate">
                                                {item.displayTitle.split(' / ').slice(0, -1).join(' / ')}
                                            </span>
                                        )}
                                    </span>
                                    
                                    {/* Source badge */}
                                    <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded ${
                                        item.source === 'project' 
                                            ? 'bg-purple-500/20 text-purple-400' 
                                            : 'bg-blue-500/20 text-blue-400'
                                    }`}>
                                        {item.source === 'project' ? 'Project' : 'Note'}
                                    </span>
                                </button>
                            ))
                        ) : (
                            <div className="px-4 py-6 text-center text-[#7d8590] text-sm">
                                No matching notes or files found
                            </div>
                        )}
                    </div>
                    
                    {/* Footer with count */}
                    {filteredItems.length > 20 && (
                        <div className="px-3 py-2 border-t border-[#30363d] bg-[#0d1117]">
                            <span className="text-xs text-[#7d8590]">
                                Showing 20 of {filteredItems.length} results
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NoteMentionInput;
