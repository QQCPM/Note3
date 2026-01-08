import React, { useState, useEffect, useCallback } from 'react';
import { Save, Brain, Target, Calendar, Eye, Edit3, X } from 'lucide-react';
import { memoryService } from '@/services/memoryService';
import { useProjectStore } from '@/store/projectStore';
import './MemoryFileEditor.css';

interface MemoryFileEditorProps {
  fileType: 'ai' | 'plan' | 'daily' | string | null;  // string for 'archive:filename'
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
      } else if (fileType === 'plan') {
        // Load Plan.md as raw content to preserve AI-written format
        // Don't parse/serialize - that loses freeform markdown
        const { invoke } = await import('@tauri-apps/api/core');
        const memoryDir = await memoryService.getMemoryDirectory();
        try {
          rawContent = await invoke<string>('read_memory_file', { path: `${memoryDir}/Plan.md` });
        } catch {
          // If file doesn't exist, create default structure
          rawContent = `# Learning Plans

## Active Plans

*No active plans. Create one by asking the AI to plan your learning!*

---

## This Week

*No weekly schedule yet.*

---

## Archived

*No archived plans yet.*
`;
        }
      } else if (fileType === 'today') {
        // Load Today.md directly as raw content
        const { invoke } = await import('@tauri-apps/api/core');
        const memoryDir = await memoryService.getMemoryDirectory();
        try {
          rawContent = await invoke<string>('read_memory_file', { path: `${memoryDir}/Today.md` });
        } catch {
          // If file doesn't exist, show placeholder
          rawContent = `# 📅 Today's Plan

## Schedule

*No plan generated yet. Ask the AI to "prepare today's schedule"!*

## Notes

`;
        }
      } else if (fileType === 'tomorrow') {
        // Load Tomorrow.md directly as raw content
        const { invoke } = await import('@tauri-apps/api/core');
        const memoryDir = await memoryService.getMemoryDirectory();
        try {
          rawContent = await invoke<string>('read_memory_file', { path: `${memoryDir}/Tomorrow.md` });
        } catch {
          // If file doesn't exist, show placeholder
          rawContent = `# 📅 Tomorrow's Plan

## Schedule

*No plan generated yet. Ask the AI to "prepare tomorrow's schedule"!*

## Notes

`;
        }
      } else if (fileType === 'daily') {
        let memory = await memoryService.loadDailyMemory(activeProjectId || undefined);
        if (!memory) {
          // Create default
          memory = await memoryService.createDefaultDailyMemory(activeProjectId || undefined);
        }
        const { serializeDailyMemory } = await import('@/services/memoryParser');
        rawContent = serializeDailyMemory(memory);
      } else if (fileType.startsWith('archive:')) {

        // Load archive file from Plans/ folder
        const archiveFilename = fileType.replace('archive:', '');
        rawContent = await memoryService.loadFromPlanArchive(archiveFilename) || '# Archive not found';
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
      } else if (fileType === 'plan') {
        // Save Plan.md as raw content to preserve AI-written format
        const { invoke } = await import('@tauri-apps/api/core');
        const memoryDir = await memoryService.getMemoryDirectory();
        await invoke('write_memory_file', { path: `${memoryDir}/Plan.md`, content });
      } else if (fileType === 'today') {
        // Save Today.md as raw content
        const { invoke } = await import('@tauri-apps/api/core');
        const memoryDir = await memoryService.getMemoryDirectory();
        await invoke('write_memory_file', { path: `${memoryDir}/Today.md`, content });
        console.log(`📝 [MemoryEditor] Saved Today.md`);
      } else if (fileType === 'tomorrow') {
        // Save Tomorrow.md as raw content
        const { invoke } = await import('@tauri-apps/api/core');
        const memoryDir = await memoryService.getMemoryDirectory();
        await invoke('write_memory_file', { path: `${memoryDir}/Tomorrow.md`, content });
        console.log(`📝 [MemoryEditor] Saved Tomorrow.md`);
      } else if (fileType === 'daily') {
        const { parseDailyMemory } = await import('@/services/memoryParser');
        const memory = parseDailyMemory(content);
        await memoryService.saveDailyMemory(memory, activeProjectId || undefined);
      } else if (fileType.startsWith('archive:')) {

        // Save archive file in Plans/ folder as raw content
        const { invoke } = await import('@tauri-apps/api/core');
        const archiveFilename = fileType.replace('archive:', '');
        const plansDir = await memoryService.getPlansDirectory();
        await invoke('write_memory_file', { path: `${plansDir}/${archiveFilename}`, content });
        console.log(`📝 [MemoryEditor] Saved archive: ${archiveFilename}`);
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
    if (fileType?.startsWith('archive:')) {
      const filename = fileType.replace('archive:', '').replace('.md', '');
      return {
        icon: <Target size={20} />,
        name: filename,
        description: 'Full archived roadmap from Plans/ folder',
        color: 'amber',
      };
    }
    switch (fileType) {
      case 'ai':
        return {
          icon: <Brain size={20} />,
          name: 'AI.md',
          description: 'Global AI preferences and learning style configuration',
          color: 'purple',
        };
      case 'plan':
        return {
          icon: <Target size={20} />,
          name: 'Plan.md',
          description: 'Learning plans, roadmaps, and progress tracking',
          color: 'green',
        };
      case 'today':
        return {
          icon: <Calendar size={20} />,
          name: 'Today.md',
          description: "Today's scheduled tasks and activities",
          color: 'blue',
        };
      case 'tomorrow':
        return {
          icon: <Calendar size={20} />,
          name: 'Tomorrow.md',
          description: "Tomorrow's planned schedule",
          color: 'purple',
        };
      case 'daily':
        return {
          icon: <Calendar size={20} />,
          name: 'Daily.md',
          description: "Today's scheduled tasks and reflection (legacy)",
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
