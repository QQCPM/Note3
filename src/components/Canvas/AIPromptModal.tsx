import React, { useEffect, useRef, useState } from 'react';

interface AIPromptModalProps {
  isOpen: boolean;
  type: 'artifact' | 'database' | 'web' | null;
  onClose: () => void;
  onGenerate: (prompt: string, type: 'artifact' | 'database' | 'web') => void;
}

const AIPromptModal: React.FC<AIPromptModalProps> = ({
  isOpen,
  type,
  onClose,
  onGenerate,
}) => {
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  // Reset prompt when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPrompt('');
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleGenerate = () => {
    if (prompt.trim() && type) {
      onGenerate(prompt.trim(), type);
      onClose();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen || !type) return null;

  const modalConfig = {
    artifact: {
      title: '🎨 Create Artifact',
      description:
        'Describe what you want to create, and AI will generate interactive HTML/CSS/JS for you.',
      placeholder: 'E.g., Create an interactive timer with start/stop buttons...',
    },
    database: {
      title: '📊 Create Database',
      description:
        'Describe your database structure, and AI will create a table with proper columns for you.',
      placeholder:
        'E.g., Create a project tracker with name, status, deadline, and priority columns...',
    },
    web: {
      title: '🌐 Embed Web Page',
      description:
        'Enter a URL to embed a website or web page directly in your note.',
      placeholder: 'E.g., https://www.youtube.com/embed/... or https://news.ycombinator.com',
    },
  };

  const config = modalConfig[type];

  return (
    <div
      className="ai-prompt-modal show"
      onClick={handleOverlayClick}
    >
      <div className="ai-prompt-content">
        <h3 className="text-lg font-semibold text-white mb-2">
          {config.title}
        </h3>
        <p className="text-sm text-gray-400 mb-4">{config.description}</p>

        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="ai-prompt-input"
          rows={4}
          placeholder={config.placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleGenerate();
            }
          }}
        />

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all"
          >
            Generate with AI
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#21262d] hover:bg-[#30363d] text-white rounded-lg text-sm transition-all"
          >
            Cancel
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          Tip: Press <kbd className="px-2 py-0.5 bg-[#0d1117] rounded">Cmd/Ctrl + Enter</kbd> to
          generate
        </p>
      </div>
    </div>
  );
};

export default AIPromptModal;
