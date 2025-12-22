import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  Search,
  Terminal,
  Check,
  X,
  Loader2,
  Plus,
  Minus,
  Edit3,
  Eye,
  Zap,
  Brain,
  Globe,
  Clock,
} from 'lucide-react';
import type { ThinkingStep, ThinkingStepStatus } from '@/store/aiStore';
import './IDEThinkingPanel.css';

interface IDEThinkingPanelProps {
  steps: ThinkingStep[];
  isLive?: boolean;
  onToggleExpand?: () => void;
}

// Operation type for IDE-style display
type OperationType = 'read' | 'write' | 'search' | 'analyze' | 'create' | 'tool' | 'thought' | 'reasoning' | 'reasoning_summary';

interface FileOperation {
  id: string;
  type: OperationType;
  fileName?: string;
  filePath?: string;
  status: ThinkingStepStatus;
  description: string;
  details?: string;
  linesRead?: number;
  linesAdded?: number;
  linesRemoved?: number;
  linesModified?: number;
  duration?: number;
  timestamp: Date;
}

// Icon mapping for operation types
const operationIcons: Record<OperationType, React.ElementType> = {
  read: Eye,
  write: Edit3,
  search: Search,
  analyze: Brain,
  create: Plus,
  tool: Terminal,
  thought: Zap,
  reasoning: Brain,
  reasoning_summary: Brain,
};

// Color mapping for operation types
const operationColors: Record<OperationType, string> = {
  read: 'text-blue-400',
  write: 'text-green-400',
  search: 'text-purple-400',
  analyze: 'text-yellow-400',
  create: 'text-emerald-400',
  tool: 'text-orange-400',
  thought: 'text-cyan-400',
  reasoning: 'text-pink-400',
  reasoning_summary: 'text-indigo-400',
};

// Format duration
const formatDuration = (ms?: number): string => {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

// Parse step to file operation
const parseStepToOperation = (step: ThinkingStep): FileOperation => {
  let type: OperationType = 'thought';
  let fileName: string | undefined;
  let filePath: string | undefined;
  let linesRead: number | undefined;
  let linesAdded: number | undefined;
  let linesRemoved: number | undefined;

  // Determine operation type from step type
  switch (step.type) {
    case 'read':
      type = 'read';
      // Try to extract file info from description
      if (step.description.includes('block')) {
        fileName = 'block content';
      } else if (step.description.includes('note')) {
        fileName = 'note content';
      }
      // Parse lines from details
      if (step.details) {
        const match = step.details.match(/(\d+)\s*characters?/i);
        if (match) {
          linesRead = Math.ceil(parseInt(match[1]) / 80); // Estimate lines
        }
      }
      break;
    case 'write':
      type = 'write';
      fileName = 'block content';
      break;
    case 'search':
      type = 'search';
      break;
    case 'create':
      type = 'create';
      if (step.details) {
        fileName = step.details;
      }
      break;
    case 'tool':
      type = 'tool';
      break;
    case 'thought':
    case 'analyze':
      type = 'analyze';
      break;
    case 'reasoning':
      type = 'reasoning';
      break;
    case 'reasoning_summary':
      type = 'reasoning_summary';
      break;
    default:
      type = 'thought';
  }

  return {
    id: step.id,
    type,
    fileName,
    filePath,
    status: step.status,
    description: step.description,
    details: step.details,
    linesRead,
    linesAdded,
    linesRemoved,
    duration: step.duration,
    timestamp: step.timestamp,
  };
};

// Status indicator component
const StatusIndicator: React.FC<{ status: ThinkingStepStatus }> = ({ status }) => {
  switch (status) {
    case 'running':
      return (
        <div className="ide-status running">
          <Loader2 className="w-3 h-3 animate-spin" />
        </div>
      );
    case 'complete':
      return (
        <div className="ide-status complete">
          <Check className="w-3 h-3" />
        </div>
      );
    case 'error':
      return (
        <div className="ide-status error">
          <X className="w-3 h-3" />
        </div>
      );
  }
};

// Single operation row
const OperationRow: React.FC<{
  operation: FileOperation;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ operation, index, isExpanded, onToggle }) => {
  const Icon = operationIcons[operation.type];
  const colorClass = operationColors[operation.type];

  return (
    <div className={`ide-operation ${operation.status}`}>
      <button className="ide-operation-header" onClick={onToggle}>
        {/* Step number */}
        <span className="ide-step-number">{index + 1}</span>

        {/* Icon */}
        <span className={`ide-operation-icon ${colorClass}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>

        {/* Description */}
        <span className="ide-operation-desc">
          {operation.description}
        </span>

        {/* File badge (if applicable) */}
        {operation.fileName && (
          <span className="ide-file-badge">
            <FileCode className="w-3 h-3" />
            {operation.fileName}
          </span>
        )}

        {/* Line stats */}
        {(operation.linesAdded || operation.linesRemoved || operation.linesRead) && (
          <span className="ide-line-stats">
            {operation.linesRead && (
              <span className="ide-lines-read">
                <Eye className="w-3 h-3" />
                {operation.linesRead}
              </span>
            )}
            {operation.linesAdded && (
              <span className="ide-lines-added">
                <Plus className="w-3 h-3" />
                {operation.linesAdded}
              </span>
            )}
            {operation.linesRemoved && (
              <span className="ide-lines-removed">
                <Minus className="w-3 h-3" />
                {operation.linesRemoved}
              </span>
            )}
          </span>
        )}

        {/* Duration */}
        {operation.duration && operation.status === 'complete' && (
          <span className="ide-duration">
            {formatDuration(operation.duration)}
          </span>
        )}

        {/* Status */}
        <StatusIndicator status={operation.status} />

        {/* Expand chevron */}
        {operation.details && (
          <ChevronRight className={`ide-chevron ${isExpanded ? 'expanded' : ''}`} />
        )}
      </button>

      {/* Expanded details */}
      {isExpanded && operation.details && (
        <div className="ide-operation-details">
          <pre className="ide-details-content">{operation.details}</pre>
        </div>
      )}
    </div>
  );
};

// Main IDE Thinking Panel
const IDEThinkingPanel: React.FC<IDEThinkingPanelProps> = ({
  steps,
  isLive = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Auto-expand when live
  useEffect(() => {
    if (isLive) {
      setIsCollapsed(false);
    }
  }, [isLive]);

  if (steps.length === 0) return null;

  const toggleItem = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Convert steps to operations
  const operations = steps.map(parseStepToOperation);

  // Calculate summary stats
  const completedCount = operations.filter(o => o.status === 'complete').length;
  const runningCount = operations.filter(o => o.status === 'running').length;
  const totalDuration = operations.reduce((acc, o) => acc + (o.duration || 0), 0);

  // Group operations by type for summary
  const searchCount = operations.filter(o => o.type === 'search').length;
  const readCount = operations.filter(o => o.type === 'read').length;
  const writeCount = operations.filter(o => o.type === 'write').length;
  const createCount = operations.filter(o => o.type === 'create').length;

  return (
    <div className={`ide-thinking-panel ${isLive ? 'live' : ''}`}>
      {/* Header */}
      <button
        className="ide-panel-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="ide-header-left">
          {/* Collapse icon */}
          <ChevronDown className={`ide-collapse-icon ${isCollapsed ? 'collapsed' : ''}`} />

          {/* Brain icon with pulse when live */}
          <div className={`ide-brain-icon ${runningCount > 0 ? 'active' : ''}`}>
            <Brain className="w-4 h-4" />
            {runningCount > 0 && <span className="ide-pulse" />}
          </div>

          {/* Title */}
          <span className="ide-panel-title">
            {runningCount > 0 ? 'AI Processing...' : 'AI Operations'}
          </span>

          {/* Progress */}
          <span className="ide-progress">
            {completedCount}/{operations.length}
          </span>
        </div>

        <div className="ide-header-right">
          {/* Operation type badges */}
          {searchCount > 0 && (
            <span className="ide-type-badge search">
              <Globe className="w-3 h-3" />
              {searchCount}
            </span>
          )}
          {readCount > 0 && (
            <span className="ide-type-badge read">
              <Eye className="w-3 h-3" />
              {readCount}
            </span>
          )}
          {writeCount > 0 && (
            <span className="ide-type-badge write">
              <Edit3 className="w-3 h-3" />
              {writeCount}
            </span>
          )}
          {createCount > 0 && (
            <span className="ide-type-badge create">
              <Plus className="w-3 h-3" />
              {createCount}
            </span>
          )}

          {/* Total duration */}
          {totalDuration > 0 && !runningCount && (
            <span className="ide-total-duration">
              <Clock className="w-3 h-3" />
              {formatDuration(totalDuration)}
            </span>
          )}

          {/* Live indicator */}
          {isLive && runningCount > 0 && (
            <span className="ide-live-badge">
              <span className="ide-live-dot" />
              Live
            </span>
          )}
        </div>
      </button>

      {/* Operations list */}
      {!isCollapsed && (
        <div className="ide-operations-list">
          {operations.map((op, index) => (
            <OperationRow
              key={op.id}
              operation={op}
              index={index}
              isExpanded={expandedItems.has(op.id)}
              onToggle={() => toggleItem(op.id)}
            />
          ))}

          {/* Current action indicator when live */}
          {isLive && runningCount > 0 && (
            <div className="ide-current-action">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="ide-typing-text">
                {operations.find(o => o.status === 'running')?.description || 'Processing...'}
              </span>
              <span className="ide-cursor" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IDEThinkingPanel;
