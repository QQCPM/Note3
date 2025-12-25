import React, { useState, useEffect, useCallback } from 'react';
import { BookMarked } from 'lucide-react';
import { CreateDefinitionDialog } from './index';
import './SelectionToolbar.css';

interface SelectionToolbarProps {
  containerRef: React.RefObject<HTMLElement>;
  noteId: string;
  blockId: string;
  projectId?: string | null;
}

interface SelectionInfo {
  text: string;
  startOffset: number;
  endOffset: number;
  rect: DOMRect;
}

const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
  containerRef,
  noteId,
  blockId,
  projectId,
}) => {
  const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const handleSelectionChange = useCallback(() => {
    if (!containerRef.current) {
      setSelectionInfo(null);
      return;
    }

    // Check if we're in a textarea (edit mode)
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLTextAreaElement && containerRef.current.contains(activeElement)) {
      const start = activeElement.selectionStart;
      const end = activeElement.selectionEnd;
      
      if (start !== end) {
        const selectedText = activeElement.value.substring(start, end).trim();
        if (selectedText.length >= 2) {
          const rect = activeElement.getBoundingClientRect();
          // Position above the textarea
          setSelectionInfo({
            text: selectedText,
            startOffset: start,
            endOffset: end,
            rect: new DOMRect(rect.left + rect.width / 2, rect.top, 0, 0),
          });
          return;
        }
      }
      setSelectionInfo(null);
      return;
    }

    // Handle regular text selection (view mode)
    const selection = window.getSelection();
    
    if (!selection || selection.isCollapsed) {
      setSelectionInfo(null);
      return;
    }

    const selectedText = selection.toString().trim();
    if (selectedText.length < 2) {
      setSelectionInfo(null);
      return;
    }

    // Check if selection is within our container
    const range = selection.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      setSelectionInfo(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    
    setSelectionInfo({
      text: selectedText,
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      rect,
    });
  }, [containerRef]);

  useEffect(() => {
    // Listen for text selection changes
    document.addEventListener('selectionchange', handleSelectionChange);
    
    // Also listen for mouseup and keyup to catch textarea selections
    document.addEventListener('mouseup', handleSelectionChange);
    document.addEventListener('keyup', handleSelectionChange);
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mouseup', handleSelectionChange);
      document.removeEventListener('keyup', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  const handleCreateDefinition = () => {
    if (selectionInfo) {
      setShowDialog(true);
    }
  };

  const handleDialogClose = () => {
    setShowDialog(false);
    setSelectionInfo(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleSuccess = () => {
    setSelectionInfo(null);
    window.getSelection()?.removeAllRanges();
  };

  if (!selectionInfo) return null;

  const toolbarStyle: React.CSSProperties = {
    position: 'fixed',
    left: selectionInfo.rect.left + selectionInfo.rect.width / 2,
    top: selectionInfo.rect.top - 40,
    transform: 'translateX(-50%)',
    zIndex: 1000,
  };

  return (
    <>
      <div className="selection-toolbar" style={toolbarStyle}>
        <button
          className="selection-toolbar-btn"
          onClick={handleCreateDefinition}
          title="Create Definition"
        >
          <BookMarked size={14} />
          <span>Define</span>
        </button>
      </div>

      <CreateDefinitionDialog
        isOpen={showDialog}
        onClose={handleDialogClose}
        selectedText={selectionInfo.text}
        noteId={noteId}
        blockId={blockId}
        startOffset={selectionInfo.startOffset}
        endOffset={selectionInfo.endOffset}
        projectId={projectId}
        onSuccess={handleSuccess}
      />
    </>
  );
};

export default SelectionToolbar;
