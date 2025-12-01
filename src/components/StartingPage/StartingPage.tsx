import React, { useEffect, useState, useRef } from 'react';
import { useUIStore, useNotesStore } from '@/store';
import { useLayoutStore } from '@/store/layoutStore';
import { useTransitionStore } from '@/store/transitionStore';
import { useAIStore } from '@/store/aiStore';
import { sendChatMessage, chatWithNoteEdit } from '@/services/chatService';
import CleanChatMessage from '../Chat/CleanChatMessage';
import ThinkingBlock from '../Chat/ThinkingBlock';
import RecommendationCard from './RecommendationCard';
import NoteMentionInput from './NoteMentionInput';
import './StartingPage.css';

import { ArrowUp, Paperclip, Globe, Mic, Zap, ChevronDown, Hexagon, Loader2 } from 'lucide-react';

const StartingPage: React.FC = () => {
    const { setAISidebarCollapsed } = useUIStore();
    const { notes } = useNotesStore();
    const { showNotePanel, notePanelVisible } = useLayoutStore();
    const { addHighlight } = useTransitionStore();
    
    // Use shared AI store for messages (synced with AgentTab)
    const { 
        messages, 
        isLoading,
        currentThinkingSteps,
        addMessage, 
        setLoading,
        toggleThinkingExpanded,
        clearCurrentThinking,
    } = useAIStore();
    
    const [inputValue, setInputValue] = useState('');
    const [selectedModel, setSelectedModel] = useState<'gpt' | 'gemini'>('gpt');
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isRecommendationsExiting, setIsRecommendationsExiting] = useState(false);

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
                // User mentioned a note - show note panel on the right
                const note = notes.find(n => n.id === mentionedNoteId);

                if (note) {
                    console.log(`📝 @mention detected: "${note.title}" (${note.id})`);

                    // Show note preview panel (slides in from right)
                    showNotePanel(note.id);

                    // Strip @mention from the message before sending to AI
                    // Handle titles with spaces by escaping special regex characters
                    const escapedTitle = note.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const mentionRegex = new RegExp(`@${escapedTitle}\\s*`, 'i');
                    const messageWithoutMention = value.replace(mentionRegex, '').trim();
                    
                    console.log(`📤 Sending to AI: "${messageWithoutMention}"`);

                    // Call AI with note context
                    const response = await chatWithNoteEdit(
                        note.id,
                        note.title,
                        messageWithoutMention,
                        []
                    );

                    // Add AI response to shared store
                    addMessage({
                        role: 'assistant',
                        content: response,
                    });
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
                            {messages.map((message, idx) => (
                                <div
                                    key={message.id}
                                    onMouseUp={() => handleTextSelection(message.id)}
                                >
                                    <CleanChatMessage
                                        role={message.role}
                                        content={message.content}
                                        isLatest={idx === messages.length - 1}
                                        messageId={message.id}
                                        thinkingSteps={message.thinkingSteps}
                                        citations={message.citations}
                                        isThinkingExpanded={message.isThinkingExpanded}
                                        onToggleThinking={() => toggleThinkingExpanded(message.id)}
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
                                    <span>AI is thinking...</span>
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
                                            <button className="p-2 text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#30363d] rounded-full transition-colors" title="Attach file">
                                                <Paperclip className="w-4 h-4" />
                                            </button>
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
                                <RecommendationCard
                                    icon={<Zap className="w-5 h-5" />}
                                    title="Test your Quantum Knowledge"
                                    description="Based on 'Quantum Physics Basics', take a quick 5-question quiz."
                                    action="Start Quiz"
                                    className="border-b md:border-0 border-[#30363d] rounded-none bg-transparent hover:bg-[#1c2128]"
                                />
                                <RecommendationCard
                                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>}
                                    title="Connect History to Psychology"
                                    description="Analyze 'The Terror' through the lens of group conformity biases."
                                    action="Analyze"
                                    className="border-b md:border-0 md:border-l border-[#30363d] rounded-none bg-transparent hover:bg-[#1c2128]"
                                />
                                <RecommendationCard
                                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>}
                                    title="Review React Patterns"
                                    description="Generate a cheat sheet from your notes on Hooks."
                                    action="Generate"
                                    className="border-b md:border-0 md:border-t border-[#30363d] rounded-none bg-transparent hover:bg-[#1c2128]"
                                />
                                <RecommendationCard
                                    icon={<Hexagon className="w-5 h-5" />}
                                    title="Explore Benzene Rings"
                                    description="Deep dive into aromaticity based on your Chem notes."
                                    action="Deep Dive"
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
                                            <button className="p-2 text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#30363d] rounded-full transition-colors" title="Attach file"><Paperclip className="w-4 h-4" /></button>
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
                                        <button className={`p-2 rounded-full transition-all duration-200 ${inputValue.trim() ? 'bg-[#58a6ff] text-white shadow-md hover:bg-[#4f98e8]' : 'bg-[#30363d] text-[#7d8590] cursor-not-allowed'}`} disabled={!inputValue.trim()}><ArrowUp className="w-4 h-4" /></button>
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
