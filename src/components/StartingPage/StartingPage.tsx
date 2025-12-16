import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useUIStore, useNotesStore } from '@/store';
import { useProjectStore } from '@/store/projectStore';
import { useLayoutStore } from '@/store/layoutStore';
import { useTransitionStore } from '@/store/transitionStore';
import { useAIStore } from '@/store/aiStore';
import { sendChatMessage, chatWithNoteEdit, chatWithGeneratedNote } from '@/services/chatService';
import { extractPDFText, PDFExtractResult } from '@/services/pdfExtractor';
import { generateProjectFromPDF, analyzePDFForPreview } from '@/services/projectGenerator';
import CleanChatMessage from '../Chat/CleanChatMessage';
import ThinkingBlock from '../Chat/ThinkingBlock';
import RecommendationCard from './RecommendationCard';
import NoteMentionInput from './NoteMentionInput';
import './StartingPage.css';

import { ArrowUp, Paperclip, Globe, Mic, Zap, ChevronDown, Loader2, FileText, X } from 'lucide-react';
import { NoteWithChildren } from '@/types';

// Helper to find note by ID recursively through all subnotes
const findNoteRecursively = (notes: NoteWithChildren[], noteId: string): NoteWithChildren | null => {
    for (const note of notes) {
        if (note.id === noteId) return note;
        if (note.children && note.children.length > 0) {
            const found = findNoteRecursively(note.children, noteId);
            if (found) return found;
        }
    }
    return null;
};

// Helper to get note content from localStorage (for generated notes)
const getNoteContent = (noteId: string): string | null => {
    return localStorage.getItem(`note-content-${noteId}`);
};

const StartingPage: React.FC = () => {
    const { setAISidebarCollapsed } = useUIStore();
    const { notes } = useNotesStore();
    const { treeItems } = useProjectStore();
    const { showNotePanel, notePanelVisible } = useLayoutStore();
    const { addHighlight } = useTransitionStore();
    
    // Use shared AI store for messages (synced with AgentTab)
    const {
        messages,
        isLoading,
        currentThinkingSteps,
        addMessage,
        setLoading,
        clearCurrentThinking,
        addPendingEdit,
    } = useAIStore();
    
    const [inputValue, setInputValue] = useState('');
    const [selectedModel, setSelectedModel] = useState<'gpt' | 'gemini'>('gpt');
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isRecommendationsExiting, setIsRecommendationsExiting] = useState(false);
    
    // PDF upload state
    const [uploadedPDF, setUploadedPDF] = useState<{ file: File; extracted: PDFExtractResult } | null>(null);
    const [isExtractingPDF, setIsExtractingPDF] = useState(false);
    const [generationProgress, setGenerationProgress] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-collapse AI sidebar when entering this page to focus on the center chat
    useEffect(() => {
        setAISidebarCollapsed(true);
    }, [setAISidebarCollapsed]);

    // Auto-scroll to latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, currentThinkingSteps]);

    const handleSubmit = async (value: string, mentionedNoteId?: string) => {
        if (!value.trim()) return;

        // If PDF is uploaded, generate project instead of regular chat
        if (uploadedPDF) {
            if (messages.length === 0) {
                setIsRecommendationsExiting(true);
                setTimeout(() => {
                    handleGenerateProject(value);
                }, 300);
            } else {
                handleGenerateProject(value);
            }
            return;
        }

        // Trigger fade-out animation if this is the first message
        if (messages.length === 0) {
            setIsRecommendationsExiting(true);
            setTimeout(() => {
                processMessage(value, mentionedNoteId);
            }, 300);
        } else {
            processMessage(value, mentionedNoteId);
        }
    };

    const processMessage = async (value: string, mentionedNoteId?: string) => {
        // Add user message to shared store
        addMessage({
            role: 'user',
            content: value,
        });
        
        setInputValue('');
        setLoading(true);
        clearCurrentThinking();

        try {
            // Check if we have a mentioned note from the input component
            if (mentionedNoteId) {
                // Find note recursively (including subnotes) or in project tree
                let note = findNoteRecursively(notes, mentionedNoteId);
                let noteTitle = note?.title || '';
                let noteContent: string | null = null;
                
                // If not found in notes store, check if it's a project tree item
                if (!note) {
                    const treeItem = treeItems.find(t => t.noteId === mentionedNoteId || t.id === mentionedNoteId);
                    if (treeItem) {
                        noteTitle = treeItem.name;
                        console.log(`📝 Found in project tree: "${noteTitle}"`);
                    }
                }
                
                // Get note content from localStorage (for generated notes)
                noteContent = getNoteContent(mentionedNoteId);
                
                if (note || noteContent) {
                    console.log(`📝 @mention detected: "${noteTitle}" (${mentionedNoteId})`);
                    console.log(`📄 Note content available: ${noteContent ? 'Yes (' + noteContent.length + ' chars)' : 'No'}`);

                    // Show note preview panel (slides in from right)
                    showNotePanel(mentionedNoteId);

                    // Strip @mention from the message before sending to AI
                    // Handle both simple titles and full paths like "Parent / Child"
                    const mentionPatterns = [
                        // Match full path with " / " separators
                        /@[^@\n]+?(?=\s+[a-z]|\s*$)/i,
                        // Match escaped title
                        new RegExp(`@${noteTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'),
                    ];
                    
                    let messageWithoutMention = value;
                    for (const pattern of mentionPatterns) {
                        const newMessage = messageWithoutMention.replace(pattern, '').trim();
                        if (newMessage !== messageWithoutMention) {
                            messageWithoutMention = newMessage;
                            break;
                        }
                    }
                    
                    // Build message with note content context for AI
                    let messageWithContext = messageWithoutMention;
                    if (noteContent) {
                        messageWithContext = `The user is referencing a note titled "${noteTitle}" with the following content:

---NOTE CONTENT START---
${noteContent}
---NOTE CONTENT END---

User's request: ${messageWithoutMention}

Please use the note content as context to fulfill the user's request.`;
                    }
                    
                    console.log(`📤 Sending to AI with note context`);

                    // Determine if this is a generated note (localStorage) or database note
                    const isGeneratedNote = noteContent !== null && noteContent.length > 0;
                    
                    if (isGeneratedNote && noteContent) {
                        // Use chatWithGeneratedNote for localStorage notes
                        console.log('📝 Using generated note flow (localStorage)');
                        const result = await chatWithGeneratedNote(
                            mentionedNoteId,
                            noteTitle,
                            noteContent,
                            messageWithoutMention
                        );

                        // Add AI response to shared store
                        addMessage({
                            role: 'assistant',
                            content: result.response,
                        });

                        // If AI generated new content, create a pending edit for review
                        if (result.newContent) {
                            console.log('📝 Creating pending edit for review');
                            addPendingEdit({
                                blockId: `generated-${mentionedNoteId}`, // Fake blockId for generated notes
                                originalContent: noteContent,
                                proposedContent: noteContent + '\n\n' + result.newContent,
                                diffHunks: [],
                                reason: `Add content to "${noteTitle}"`,
                                noteId: mentionedNoteId,
                                isGeneratedNote: true,
                            });
                        }
                    } else {
                        // Use chatWithNoteEdit for database notes
                        console.log('📝 Using database note flow');
                        const response = await chatWithNoteEdit(
                            mentionedNoteId,
                            noteTitle,
                            messageWithContext,
                            []
                        );

                        // Add AI response to shared store
                        addMessage({
                            role: 'assistant',
                            content: response,
                        });
                    }
                    
                    setLoading(false);
                    return;
                }
            }

            // Normal chat response (no @mention)
            console.log('💬 Regular chat message');
            const response = await sendChatMessage([], value);

            // Add AI response to shared store
            addMessage({
                role: 'assistant',
                content: response,
            });
            setLoading(false);
        } catch (error) {
            console.error('❌ AI chat error:', error);

            // Show error message
            addMessage({
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please make sure the AI service is running and try again.',
            });
            setLoading(false);
        }
    };

    // Handle text selection for highlights
    const handleTextSelection = (messageId: string) => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();

        if (selectedText && selectedText.length > 3) {
            addHighlight({
                text: selectedText,
                messageId,
            });
            console.log('✓ Captured highlight:', selectedText);
        }
    };

    // Handle PDF file upload
    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
            return;
        }

        setIsExtractingPDF(true);
        try {
            console.log(`📄 Extracting PDF: ${file.name}`);
            const extracted = await extractPDFText(file);
            setUploadedPDF({ file, extracted });
            
            // Show preview in chat
            const preview = await analyzePDFForPreview(extracted);
            addMessage({
                role: 'assistant',
                content: preview,
            });
            
            console.log(`✅ PDF extracted: ${extracted.totalPages} pages, ${extracted.wordCount} words`);
        } catch (error) {
            console.error('Failed to extract PDF:', error);
            addMessage({
                role: 'assistant',
                content: '❌ Failed to read the PDF file. Please make sure it\'s a valid PDF.',
            });
        } finally {
            setIsExtractingPDF(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }, [addMessage]);

    // Handle project generation from PDF
    const handleGenerateProject = useCallback(async (userPrompt: string) => {
        if (!uploadedPDF) return;

        setLoading(true);
        setGenerationProgress('Starting...');
        
        addMessage({
            role: 'user',
            content: userPrompt,
        });

        try {
            const result = await generateProjectFromPDF(
                uploadedPDF.extracted,
                userPrompt,
                (progress) => {
                    setGenerationProgress(progress.message);
                }
            );

            addMessage({
                role: 'assistant',
                content: result,
            });

            // Clear uploaded PDF after successful generation
            setUploadedPDF(null);
        } catch (error) {
            console.error('Project generation failed:', error);
            addMessage({
                role: 'assistant',
                content: '❌ Failed to generate project. Please try again.',
            });
        } finally {
            setLoading(false);
            setGenerationProgress(null);
        }
    }, [uploadedPDF, addMessage, setLoading]);

    // Clear uploaded PDF
    const clearUploadedPDF = useCallback(() => {
        setUploadedPDF(null);
    }, []);

    return (
        <div
            className="flex-1 flex flex-col bg-[#0d1117] transition-all duration-400 overflow-visible"
            style={{
                width: notePanelVisible ? '50%' : '100%',
            }}
        >
            {messages.length > 0 ? (
                <>
                    {/* Chat mode: messages at top, input at bottom */}
                    <div className="flex-1 overflow-y-auto overflow-x-visible p-8">
                        <div className="w-full max-w-[640px] mx-auto space-y-6">
                            {messages
                                .filter((message) => message.role !== 'system')
                                .map((message, idx, filteredMessages) => (
                                <div
                                    key={message.id}
                                    onMouseUp={() => handleTextSelection(message.id)}
                                >
                                    <CleanChatMessage
                                        role={message.role as 'user' | 'assistant'}
                                        content={message.content}
                                        isLatest={idx === filteredMessages.length - 1}
                                        messageId={message.id}
                                        thinkingSteps={message.thinkingSteps}
                                        citations={message.citations}
                                    />
                                </div>
                            ))}

                            {/* Live thinking display while AI is processing */}
                            {isLoading && currentThinkingSteps.length > 0 && (
                                <ThinkingBlock
                                    steps={currentThinkingSteps}
                                    isExpanded={true}
                                    isLive={true}
                                />
                            )}

                            {/* AI typing indicator */}
                            {isLoading && currentThinkingSteps.length === 0 && (
                                <div className="flex items-center gap-2 text-[#7d8590] text-sm py-4">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>{generationProgress || 'AI is thinking...'}</span>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Fixed input at bottom */}
                    <div className="bg-[#0d1117] p-8 relative z-10 overflow-visible">
                        <div className="w-full max-w-[640px] mx-auto relative z-10 overflow-visible">
                            <div className="relative">
                                <div className="relative bg-[#161b22] rounded-[32px] border border-[#30363d] p-3 flex flex-col gap-2">
                                    <NoteMentionInput
                                        value={inputValue}
                                        onChange={setInputValue}
                                        onSubmit={handleSubmit}
                                        disabled={isLoading}
                                    />

                                    <div className="flex items-center justify-between pt-2 px-2">
                                        <div className="flex items-center gap-2">
                                            {/* Hidden file input */}
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".pdf"
                                                onChange={handleFileUpload}
                                                className="hidden"
                                            />
                                            <button 
                                                onClick={() => fileInputRef.current?.click()}
                                                className={`p-2 rounded-full transition-colors ${uploadedPDF ? 'text-[#58a6ff] bg-[#58a6ff]/10' : 'text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#30363d]'}`}
                                                title={uploadedPDF ? `PDF: ${uploadedPDF.file.name}` : "Attach PDF"}
                                                disabled={isExtractingPDF}
                                            >
                                                {isExtractingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                                            </button>
                                            {/* Show uploaded PDF indicator */}
                                            {uploadedPDF && (
                                                <div className="flex items-center gap-1 px-2 py-1 bg-[#58a6ff]/10 rounded-full">
                                                    <FileText className="w-3 h-3 text-[#58a6ff]" />
                                                    <span className="text-xs text-[#58a6ff] max-w-[100px] truncate">{uploadedPDF.file.name}</span>
                                                    <button onClick={clearUploadedPDF} className="p-0.5 hover:bg-[#30363d] rounded">
                                                        <X className="w-3 h-3 text-[#7d8590]" />
                                                    </button>
                                                </div>
                                            )}
                                            <button className="p-2 text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#30363d] rounded-full transition-colors" title="Voice input">
                                                <Mic className="w-4 h-4" />
                                            </button>
                                            <div className="h-5 w-[1px] bg-[#30363d] mx-1"></div>
                                            <div className="relative">
                                                <button
                                                    onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                                                    className="flex items-center gap-2 px-3 py-1.5 text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#30363d] rounded-full transition-colors text-xs font-medium"
                                                >
                                                    <img
                                                        src={selectedModel === 'gpt' ? "/src/assets/gpt-logo.svg" : "/src/assets/gemini-logo.png"}
                                                        alt={selectedModel === 'gpt' ? "GPT-5.1" : "Gemini 2.5 Pro"}
                                                        className="w-3.5 h-3.5 object-contain"
                                                    />
                                                    {selectedModel === 'gpt' ? 'GPT-5.1' : 'Gemini 2.5 Pro'}
                                                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                                                </button>

                                                {isModelDropdownOpen && (
                                                    <div className="absolute top-full left-0 mt-2 w-40 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedModel('gpt');
                                                                setIsModelDropdownOpen(false);
                                                            }}
                                                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${selectedModel === 'gpt' ? 'bg-[#1f6feb]/10 text-[#58a6ff]' : 'text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#30363d]'}`}
                                                        >
                                                            <img src="/src/assets/gpt-logo.svg" alt="GPT-5.1" className="w-3.5 h-3.5 object-contain" />
                                                            GPT-5.1
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedModel('gemini');
                                                                setIsModelDropdownOpen(false);
                                                            }}
                                                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${selectedModel === 'gemini' ? 'bg-[#1f6feb]/10 text-[#58a6ff]' : 'text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#30363d]'}`}
                                                        >
                                                            <img src="/src/assets/gemini-logo.png" alt="Gemini 2.5 Pro" className="w-3.5 h-3.5 object-contain opacity-80" />
                                                            Gemini 2.5 Pro
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <button className="flex items-center gap-2 px-3 py-1.5 text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#30363d] rounded-full transition-colors text-xs font-medium">
                                                <Globe className="w-3 h-3" />
                                                Research
                                            </button>
                                        </div>

                                        <button
                                            className={`p-2 rounded-full transition-all duration-200 ${inputValue.trim() && !isLoading ? 'bg-[#58a6ff] text-white shadow-md hover:bg-[#4f98e8]' : 'bg-[#30363d] text-[#7d8590] cursor-not-allowed'}`}
                                            disabled={!inputValue.trim() || isLoading}
                                        >
                                            {isLoading ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <ArrowUp className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                // Empty state: centered
                <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
                    <div className="w-full max-w-[640px] flex flex-col gap-10">
                        {/* Recommendations */}
                        <div className={`space-y-4 recommendations-container ${isRecommendationsExiting ? 'recommendations-exiting' : ''}`}>
                            <div className="flex items-center gap-2 text-[#7d8590] text-xs font-bold tracking-wider uppercase px-1">
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M9.5 1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM7.25 4a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75V4Z"></path></svg>
                                Suggested for you
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 rounded-xl overflow-hidden">
                                {/* Deep Learning */}
                                <RecommendationCard
                                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M16 14v1a4 4 0 0 1-8 0v-1"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/><path d="M12 11v3"/></svg>}
                                    title="Explain VAE vs DAG"
                                    description="Compare Variational Autoencoders and DAG models from your Deep Learning notes."
                                    action="Compare"
                                    className="border-b md:border-0 border-[#30363d] rounded-none bg-transparent hover:bg-[#1c2128]"
                                />
                                {/* Neuroscience 2 */}
                                <RecommendationCard
                                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.4V22h6v-4.6c2.9-1.1 5-4 5-7.4a8 8 0 0 0-8-8z"/><path d="M9 10h.01M15 10h.01M9 14c.5.5 1.5 1 3 1s2.5-.5 3-1"/></svg>}
                                    title="Quiz on Neural Pathways"
                                    description="Test your understanding of synaptic plasticity from Neuroscience 2."
                                    action="Start Quiz"
                                    className="border-b md:border-0 md:border-l border-[#30363d] rounded-none bg-transparent hover:bg-[#1c2128]"
                                />
                                {/* Quantum computing */}
                                <RecommendationCard
                                    icon={<Zap className="w-5 h-5" />}
                                    title="Quantum Gates Cheatsheet"
                                    description="Generate a quick reference for Hadamard, CNOT, and Pauli gates."
                                    action="Generate"
                                    className="border-b md:border-0 md:border-t border-[#30363d] rounded-none bg-transparent hover:bg-[#1c2128]"
                                />
                                {/* React Coding */}
                                <RecommendationCard
                                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/></svg>}
                                    title="React Hooks Deep Dive"
                                    description="Explain useEffect cleanup and dependency arrays from your React notes."
                                    action="Explain"
                                    className="md:border-l md:border-t border-[#30363d] rounded-none bg-transparent hover:bg-[#1c2128]"
                                />
                            </div>
                        </div>

                        {/* Input box (centered) */}
                        <div className="text-center space-y-6">
                            <div className="relative">
                                <div className="relative bg-[#161b22] rounded-[32px] border border-[#30363d] p-3 flex flex-col gap-2">
                                    <NoteMentionInput
                                        value={inputValue}
                                        onChange={setInputValue}
                                        onSubmit={handleSubmit}
                                        disabled={isLoading}
                                    />

                                    <div className="flex items-center justify-between pt-2 px-2">
                                        <div className="flex items-center gap-2">
                                            {/* Hidden file input for empty state */}
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".pdf"
                                                onChange={handleFileUpload}
                                                className="hidden"
                                            />
                                            <button 
                                                onClick={() => fileInputRef.current?.click()}
                                                className={`p-2 rounded-full transition-colors ${uploadedPDF ? 'text-[#58a6ff] bg-[#58a6ff]/10' : 'text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#30363d]'}`}
                                                title={uploadedPDF ? `PDF: ${uploadedPDF.file.name}` : "Attach PDF"}
                                                disabled={isExtractingPDF}
                                            >
                                                {isExtractingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                                            </button>
                                            {/* Show uploaded PDF indicator */}
                                            {uploadedPDF && (
                                                <div className="flex items-center gap-1 px-2 py-1 bg-[#58a6ff]/10 rounded-full">
                                                    <FileText className="w-3 h-3 text-[#58a6ff]" />
                                                    <span className="text-xs text-[#58a6ff] max-w-[100px] truncate">{uploadedPDF.file.name}</span>
                                                    <button onClick={clearUploadedPDF} className="p-0.5 hover:bg-[#30363d] rounded">
                                                        <X className="w-3 h-3 text-[#7d8590]" />
                                                    </button>
                                                </div>
                                            )}
                                            <button className="p-2 text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#30363d] rounded-full transition-colors" title="Voice input"><Mic className="w-4 h-4" /></button>
                                            <div className="h-5 w-[1px] bg-[#30363d] mx-1"></div>
                                            <div className="relative">
                                                <button onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)} className="flex items-center gap-2 px-3 py-1.5 text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#30363d] rounded-full transition-colors text-xs font-medium">
                                                    <img src={selectedModel === 'gpt' ? "/src/assets/gpt-logo.svg" : "/src/assets/gemini-logo.png"} alt={selectedModel === 'gpt' ? "GPT-5.1" : "Gemini 2.5 Pro"} className="w-3.5 h-3.5 object-contain" />
                                                    {selectedModel === 'gpt' ? 'GPT-5.1' : 'Gemini 2.5 Pro'}
                                                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                                                </button>
                                                {isModelDropdownOpen && (
                                                    <div className="absolute top-full left-0 mt-2 w-40 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                                                        <button onClick={() => { setSelectedModel('gpt'); setIsModelDropdownOpen(false); }} className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${selectedModel === 'gpt' ? 'bg-[#1f6feb]/10 text-[#58a6ff]' : 'text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#30363d]'}`}>
                                                            <img src="/src/assets/gpt-logo.svg" alt="GPT-5.1" className="w-3.5 h-3.5 object-contain" />GPT-5.1
                                                        </button>
                                                        <button onClick={() => { setSelectedModel('gemini'); setIsModelDropdownOpen(false); }} className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${selectedModel === 'gemini' ? 'bg-[#1f6feb]/10 text-[#58a6ff]' : 'text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#30363d]'}`}>
                                                            <img src="/src/assets/gemini-logo.png" alt="Gemini 2.5 Pro" className="w-3.5 h-3.5 object-contain opacity-80" />Gemini 2.5 Pro
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <button className="flex items-center gap-2 px-3 py-1.5 text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#30363d] rounded-full transition-colors text-xs font-medium"><Globe className="w-3 h-3" /> Research</button>
                                        </div>
                                        <button className={`p-2 rounded-full transition-all duration-200 ${inputValue.trim() || uploadedPDF ? 'bg-[#58a6ff] text-white shadow-md hover:bg-[#4f98e8]' : 'bg-[#30363d] text-[#7d8590] cursor-not-allowed'}`} disabled={!inputValue.trim() && !uploadedPDF}><ArrowUp className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StartingPage;
