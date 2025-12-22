import React, { useState, useEffect } from 'react';
import { X, BookMarked } from 'lucide-react';
import { useRootNodeStore } from '@/store/rootNodeStore';
import type { CreateRootNodeInput } from '@/types/rootNode';
import './CreateDefinitionDialog.css';

interface CreateDefinitionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText: string;
  noteId: string;
  blockId: string;
  startOffset: number;
  endOffset: number;
  projectId?: string | null;
  onSuccess?: () => void;
}

const CreateDefinitionDialog: React.FC<CreateDefinitionDialogProps> = ({
  isOpen,
  onClose,
  selectedText,
  noteId,
  blockId,
  startOffset,
  endOffset,
  projectId,
  onSuccess,
}) => {
  const [term, setTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { createRootNode } = useRootNodeStore();

  // Extract potential term from selected text (first few words or the whole thing if short)
  useEffect(() => {
    if (selectedText) {
      const words = selectedText.trim().split(/\s+/);
      if (words.length <= 3) {
        setTerm(selectedText.trim());
      } else {
        // Take first 3 words as default term
        setTerm(words.slice(0, 3).join(' '));
      }
    }
  }, [selectedText]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!term.trim()) {
      setError('Please enter a term for this definition');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const input: CreateRootNodeInput = {
        term: term.trim(),
        highlighted_text: selectedText,
        note_id: noteId,
        block_id: blockId,
        start_offset: startOffset,
        end_offset: endOffset,
        project_id: projectId,
        created_by: 'user',
      };

      await createRootNode(input);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to create definition');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="definition-dialog-overlay" onClick={onClose}>
      <div className="definition-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="definition-dialog-header">
          <div className="definition-dialog-title">
            <BookMarked className="w-5 h-5" />
            <span>Create Definition</span>
          </div>
          <button className="definition-dialog-close" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="definition-dialog-content">
            <div className="definition-field">
              <label htmlFor="term">Term</label>
              <input
                id="term"
                type="text"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="e.g., Backpropagation"
                autoFocus
              />
              <span className="field-hint">This is what you'll type after @ to reference this definition</span>
            </div>

            <div className="definition-field">
              <label>Definition</label>
              <div className="definition-preview">
                {selectedText}
              </div>
              <span className="field-hint">The highlighted text that will be shown when referenced</span>
            </div>

            {error && (
              <div className="definition-error">
                {error}
              </div>
            )}
          </div>

          <div className="definition-dialog-footer">
            <button
              type="button"
              className="definition-btn definition-btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="definition-btn definition-btn-primary"
              disabled={isSubmitting || !term.trim()}
            >
              {isSubmitting ? 'Creating...' : 'Create Definition'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDefinitionDialog;
