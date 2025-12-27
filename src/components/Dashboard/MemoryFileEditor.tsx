import React, { useState, useEffect, useCallback } from 'react';
import { Save, Brain, Target, Calendar, Eye, Edit3, X } from 'lucide-react';
import { memoryService } from '@/services/memoryService';
import { useProjectStore } from '@/store/projectStore';
import './MemoryFileEditor.css';

interface MemoryFileEditorProps {
  fileType: 'ai' | 'project' | 'daily' | null;
  onClose: () => void;
}

const MemoryFileEditor: React.FC<MemoryFileEditorProps> = ({ fileType, onClose }) => {
  const { activeProjectId } = useProjectStore();
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load file content
  useEffect(() => {
    if (fileType) {
      loadContent();
    }
  }, [fileType, activeProjectId]);

  const loadContent = async () => {
    if (!fileType) return;

    setIsLoading(true);
    setError(null);

    try {
      let rawContent = '';

      if (fileType === 'ai') {
        let memory = await memoryService.loadAIMemory();
        if (!memory) {
          // Create default if doesn't exist
          memory = await memoryService.createDefaultAIMemory();
        }
        const { serializeAIMemory } = await import('@/services/memoryParser');
        rawContent = serializeAIMemory(memory);
      } else if (fileType === 'project') {
        let memory = activeProjectId
          ? await memoryService.loadProjectMemory(activeProjectId)
          : null;
        if (!memory) {
          // Create default - use project-specific or global
          memory = await memoryService.createDefaultProjectMemory(activeProjectId || 'global');
        }
        const { serializeProjectMemory } = await import('@/services/memoryParser');
        rawContent = serializeProjectMemory(memory);
      } else if (fileType === 'daily') {
        let memory = await memoryService.loadDailyMemory(activeProjectId || undefined);
        if (!memory) {
          // Create default
          memory = await memoryService.createDefaultDailyMemory(activeProjectId || undefined);
        }
        const { serializeDailyMemory } = await import('@/services/memoryParser');
        rawContent = serializeDailyMemory(memory);
      }

      setContent(rawContent);
      setOriginalContent(rawContent);
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to load content:', err);
      setError('Failed to load file content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!fileType || !hasChanges) return;

    setIsSaving(true);
    setError(null);

    try {
      if (fileType === 'ai') {
        const { parseAIMemory } = await import('@/services/memoryParser');
        const memory = parseAIMemory(content);
        await memoryService.saveAIMemory(memory);
      } else if (fileType === 'project' && activeProjectId) {
        const { parseProjectMemory } = await import('@/services/memoryParser');
        const memory = parseProjectMemory(content);
        await memoryService.saveProjectMemory(activeProjectId, memory);
      } else if (fileType === 'daily') {
        const { parseDailyMemory } = await import('@/services/memoryParser');
        const memory = parseDailyMemory(content);
        await memoryService.saveDailyMemory(memory, activeProjectId || undefined);
      }

      setOriginalContent(content);
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save:', err);
      setError('Failed to save file. Check your markdown syntax.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setHasChanges(newContent !== originalContent);
  }, [originalContent]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges) {
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, handleSave]);

  const getFileInfo = () => {
    switch (fileType) {
      case 'ai':
        return {
          icon: <Brain size={20} />,
          name: 'AI.md',
          description: 'Global AI preferences and learning style configuration',
          color: 'purple',
        };
      case 'project':
        return {
          icon: <Target size={20} />,
          name: 'Plan.md',
          description: 'Learning plans, roadmaps, and progress tracking',
          color: 'green',
        };
      case 'daily':
        return {
          icon: <Calendar size={20} />,
          name: 'Daily.md',
          description: "Today's scheduled tasks and reflection",
          color: 'blue',
        };
      default:
        return null;
    }
  };

  if (!fileType) {
    return (
      <div className="memory-editor-empty">
        <div className="empty-content">
          <Brain size={48} className="empty-icon" />
          <h3>Select a Memory File</h3>
          <p>Choose a file from the sidebar to view and edit your AI memory configuration.</p>
        </div>
      </div>
    );
  }

  const fileInfo = getFileInfo();

  if (isLoading) {
    return (
      <div className="memory-editor-loading">
        <div className="loading-spinner" />
        <span>Loading {fileInfo?.name}...</span>
      </div>
    );
  }

  return (
    <div className="memory-editor">
      {/* Header - Simple & Clean */}
      <div className="memory-editor-header">
        <div className="header-left">
          <button className="close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
          <span className={`file-icon-small ${fileInfo?.color}`}>
            {fileInfo?.icon}
          </span>
          <span className="file-title">
            {fileInfo?.name}
            {hasChanges && <span className="unsaved-dot" />}
          </span>
        </div>

        <div className="header-actions">
          <button
            className={`icon-btn ${!isPreview ? 'active' : ''}`}
            onClick={() => setIsPreview(false)}
            title="Edit"
          >
            <Edit3 size={15} />
          </button>
          <button
            className={`icon-btn ${isPreview ? 'active' : ''}`}
            onClick={() => setIsPreview(true)}
            title="Preview"
          >
            <Eye size={15} />
          </button>
          <button
            className="save-btn"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? <span className="saving-spinner" /> : <Save size={14} />}
            Save
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Editor / Preview */}
      <div className="memory-editor-content">
        {isPreview ? (
          <div className="preview-content">
            <pre className="markdown-preview">{content}</pre>
          </div>
        ) : (
          <textarea
            className="editor-textarea"
            value={content}
            onChange={handleContentChange}
            placeholder={`# ${fileInfo?.name}\n\nStart editing your memory file...`}
            spellCheck={false}
          />
        )}
      </div>

      {/* Footer */}
      <div className="memory-editor-footer">
        <span className="shortcut-hint">
          Press <kbd>⌘</kbd> + <kbd>S</kbd> to save
        </span>
        <span className="char-count">
          {content.length} characters
        </span>
      </div>
    </div>
  );
};

export default MemoryFileEditor;
