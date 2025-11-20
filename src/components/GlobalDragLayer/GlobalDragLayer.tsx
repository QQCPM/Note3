import React, { useEffect, useRef } from 'react';
import { useDragStore } from '@/store/dragStore';

/**
 * GlobalDragLayer - A world-class drag preview that floats above everything
 *
 * This component renders a visual preview of the dragged note at the exact
 * mouse position. It's positioned in screen coordinates (fixed positioning),
 * completely decoupled from any parent's transform/scroll context.
 *
 * Performance: Uses direct DOM manipulation for 60fps smooth updates
 */
const GlobalDragLayer: React.FC = () => {
  const { isDragging, draggedNote, mousePosition } = useDragStore();
  const dragPreviewRef = useRef<HTMLDivElement>(null);

  // Update position using direct DOM manipulation for 60fps performance
  // This bypasses React's reconciliation and provides buttery-smooth movement
  useEffect(() => {
    if (!isDragging || !mousePosition || !dragPreviewRef.current) return;

    const preview = dragPreviewRef.current;

    // Use transform for GPU-accelerated rendering
    // Offset by half the preview size to center it on the cursor
    const offsetX = -100; // Half of preview width (200px / 2)
    const offsetY = -25;  // Quarter of preview height for better visual feedback

    preview.style.transform = `translate(${mousePosition.x + offsetX}px, ${mousePosition.y + offsetY}px)`;
  }, [isDragging, mousePosition]);

  if (!isDragging || !draggedNote || !mousePosition) {
    return null;
  }

  return (
    <div
      ref={dragPreviewRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        pointerEvents: 'none', // CRITICAL: Allow mouse events to pass through
        zIndex: 10000, // Above everything
        willChange: 'transform', // Hint to browser for GPU optimization
      }}
    >
      {/* The dragged note preview card */}
      <div
        style={{
          width: '200px',
          height: '150px',
          background: 'linear-gradient(135deg, #a78bfa 0%, #60a5fa 100%)',
          borderRadius: '12px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          opacity: 0.95,
          transform: 'rotate(-2deg)', // Slight tilt for visual feedback
          transition: 'opacity 0.2s ease', // Smooth fade in
        }}
      >
        {/* Note icon */}
        <div style={{ fontSize: '24px' }}>
          {draggedNote.icon}
        </div>

        {/* Note title */}
        <div
          style={{
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {draggedNote.title}
        </div>

        {/* Visual indicator */}
        <div
          style={{
            marginTop: 'auto',
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.7)',
            fontWeight: 500,
          }}
        >
          Drop on canvas to create
        </div>
      </div>
    </div>
  );
};

export default GlobalDragLayer;
