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
    const selection = window.getSelection();
    
    if (!selection || selection.isCollapsed || !containerRef.current) {
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
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
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
