import React, { useState } from 'react';
import { Check, Loader2, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react';
import type { ThinkingStep, ThinkingStepStatus } from '@/store/aiStore';
import './ActionLog.css';

interface ActionLogProps {
  logs: ThinkingStep[];
}

interface LogItemProps {
  log: ThinkingStep;
  isLast: boolean;
}

// Status icon component
const StatusIcon: React.FC<{ status: ThinkingStepStatus }> = ({ status }) => {
  switch (status) {
    case 'complete':
      return (
        <div className="action-log-icon complete">
          <Check size={12} strokeWidth={3} />
        </div>
      );
    case 'running':
      return (
        <div className="action-log-icon running">
          <Loader2 size={12} className="animate-spin" />
        </div>
      );
    case 'error':
      return (
        <div className="action-log-icon error">
          <AlertCircle size={12} />
        </div>
      );
    default:
      return (
        <div className="action-log-icon complete">
          <Check size={12} strokeWidth={3} />
        </div>
      );
  }
};

// Format the step title based on type and description
const formatStepTitle = (log: ThinkingStep): string => {
  const desc = log.description || '';
  
  // Use description if it's a good title (not too long, not ending with ...)
  if (desc && desc.length < 60 && !desc.endsWith('...')) {
    // Capitalize first letter
    return desc.charAt(0).toUpperCase() + desc.slice(1);
  }
  
  // Generate title based on type
  switch (log.type) {
    case 'thought':
    case 'analyze':
      return 'Analyzing request intent';
    case 'search':
      // Extract query from description if present
      const searchMatch = desc.match(/["""](.+?)["""]/);
      if (searchMatch) {
        const query = searchMatch[1];
        return query.length > 40 ? `Searched "${query.substring(0, 40)}..."` : `Searched "${query}"`;
      }
      return 'Searching the web';
    case 'read':
      if (desc.includes('block')) return 'Reading block content';
      if (desc.includes('note')) return 'Reading note content';
      return 'Reading content';
    case 'write':
      // Extract line/char info if present
      const writeMatch = desc.match(/\((\d+)\s*lines?,\s*(\d+)\s*chars?\)/);
      if (writeMatch) {
        return `Editing block (${writeMatch[1]} lines)`;
      }
      return 'Preparing changes';
    case 'create':
      if (desc.includes('table') || desc.includes('database')) return 'Creating database table';
      if (desc.includes('artifact')) return 'Creating interactive artifact';
      return 'Creating content';
    case 'tool':
      return desc || 'Executing tool';
    case 'reasoning':
      return 'Reasoning through problem';
    case 'reasoning_summary':
      return 'Synthesizing explanation';
    case 'explore':
      // Count files if details contain file list
      if (log.details) {
        const files = log.details.split(/[;\n]/).filter(Boolean);
        if (files.length > 0) {
          return `Explored ${files.length} files`;
        }
      }
      return 'Exploring codebase';
    default:
      return desc || 'Processing';
  }
};

// Parse details into array of lines
const parseDetails = (log: ThinkingStep): string[] => {
  const lines: string[] = [];
  const desc = log.description || '';
  const details = log.details || '';
  
  // For reasoning steps, show the reasoning content
  if (log.type === 'reasoning' || log.type === 'reasoning_summary') {
    if (details) {
      lines.push(details);
    }
    return lines;
  }
  
  // For analyze/thought steps, generate structured details
  if (log.type === 'thought' || log.type === 'analyze') {
    // These are typically quick analysis steps, no details needed
    return lines;
  }
  
  // For search steps, show what was found
  if (log.type === 'search') {
    if (details) {
      // Details might contain result count or sources
      const parts = details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
      lines.push(...parts);
    }
    return lines;
  }
  
  // For read steps, show what was read
  if (log.type === 'read') {
    if (details) {
      lines.push(details);
    }
    return lines;
  }
  
  // For write steps, show line counts
  if (log.type === 'write') {
    const match = desc.match(/\((\d+)\s*lines?,\s*(\d+)\s*chars?\)/);
    if (match) {
      lines.push(`Lines modified: ${match[1]}`);
      lines.push(`Characters: ${match[2]}`);
    }
    if (details) {
      lines.push(details);
    }
    return lines;
  }
  
  // For explore steps, show file list
  if (log.type === 'explore') {
    if (details) {
      const files = details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
      lines.push(...files);
    }
    return lines;
  }
  
  // For create steps, show what was created
  if (log.type === 'create') {
    if (details) {
      lines.push(details);
    }
    return lines;
  }
  
  // Default: split details by newlines or semicolons
  if (details) {
    const parts = details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
    lines.push(...parts);
  }
  
  return lines;
};

// Individual log item
const LogItem: React.FC<LogItemProps> = ({ log, isLast }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const details = parseDetails(log);
  const hasDetails = details.length > 0;
  const title = formatStepTitle(log);

  return (
    <div className={`action-log-item ${isLast ? 'last' : ''}`}>
      {/* Connector line */}
      {!isLast && <div className="action-log-connector" />}
      
      {/* Header row */}
      <div 
        className={`action-log-header ${hasDetails ? 'expandable' : ''}`}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >
        <StatusIcon status={log.status} />
        <span className="action-log-title">{title}</span>
        {hasDetails && (
          <button className="action-log-toggle">
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>
      
      {/* Details section */}
      {hasDetails && isExpanded && (
        <div className="action-log-details">
          {details.map((detail, idx) => (
            <div key={idx} className="action-log-detail-line">
              {detail}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Main ActionLog component
const ActionLog: React.FC<ActionLogProps> = ({ logs }) => {
  if (!logs || logs.length === 0) return null;

  return (
    <div className="action-log-container">
      {logs.map((log, index) => (
        <LogItem 
          key={log.id || index} 
          log={log} 
          isLast={index === logs.length - 1}
        />
      ))}
    </div>
  );
};

export default ActionLog;
