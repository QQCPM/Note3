import React, { useState } from 'react';
import { ChevronRight, Globe, Search, FileText, Loader2 } from 'lucide-react';
import type { ThinkingStep } from '@/store/aiStore';
import './ProgressTimeline.css';

interface ProgressTimelineProps {
  steps: ThinkingStep[];
  isLive?: boolean;
}

// Format duration in human-readable form
const formatDuration = (ms?: number): string => {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

// Thought block component
const ThoughtBlock: React.FC<{
  duration: number;
  isExpanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}> = ({ duration, isExpanded, onToggle, children }) => (
  <div className="timeline-thought">
    <button className="thought-header" onClick={onToggle}>
      <span className="thought-label">Thought for {formatDuration(duration)}</span>
      <ChevronRight className={`thought-chevron ${isExpanded ? 'expanded' : ''}`} />
    </button>
    {isExpanded && children && (
      <div className="thought-content">{children}</div>
    )}
  </div>
);

// Tool call block (bordered box)
const ToolBlock: React.FC<{
  step: ThinkingStep;
}> = ({ step }) => {
  const getIcon = () => {
    switch (step.type) {
      case 'search': return <Globe className="w-4 h-4" />;
      case 'read': return <FileText className="w-4 h-4" />;
      default: return <Search className="w-4 h-4" />;
    }
  };

  return (
    <div className="timeline-tool-block">
      <span className="tool-icon">{getIcon()}</span>
      <span className="tool-description">{step.description}</span>
      {step.duration && (
        <span className="tool-duration">in {formatDuration(step.duration)}</span>
      )}
      {step.status === 'running' && (
        <Loader2 className="w-3 h-3 animate-spin text-blue-400 ml-2" />
      )}
    </div>
  );
};

// Expandable file/search result line
const ExpandableLine: React.FC<{
  prefix: string;
  main: string;
  suffix?: string;
  details?: string[];
  isExpanded?: boolean;
  onToggle?: () => void;
}> = ({ prefix, main, suffix, details, isExpanded, onToggle }) => {
  const hasDetails = details && details.length > 0;
  
  return (
    <div className="timeline-expandable">
      <button 
        className="expandable-header" 
        onClick={onToggle}
        disabled={!hasDetails}
      >
        <span className="expandable-prefix">{prefix}</span>
        <span className="expandable-main">{main}</span>
        {suffix && <span className="expandable-suffix">{suffix}</span>}
        {hasDetails && (
          <ChevronRight className={`expandable-chevron ${isExpanded ? 'expanded' : ''}`} />
        )}
      </button>
      {isExpanded && details && (
        <div className="expandable-details">
          {details.map((detail, idx) => (
            <div key={idx} className="detail-line">
              <span className="detail-text">{detail}</span>
              <ChevronRight className="detail-chevron" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Current action indicator (typing effect)
const CurrentAction: React.FC<{ text: string }> = ({ text }) => (
  <div className="timeline-current">
    <span className="current-text">{text}</span>
    <span className="current-cursor" />
  </div>
);

const ProgressTimeline: React.FC<ProgressTimelineProps> = ({ steps, isLive = false }) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
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

  if (steps.length === 0) return null;

  // Process steps into timeline items
  const renderTimeline = () => {
    const items: React.ReactNode[] = [];
    let currentThoughtDuration = 0;
    let thoughtSteps: ThinkingStep[] = [];
    
    const flushThought = () => {
      if (currentThoughtDuration > 0) {
        const thoughtId = `thought-${items.length}`;
        items.push(
          <ThoughtBlock
            key={thoughtId}
            duration={currentThoughtDuration}
            isExpanded={expandedItems.has(thoughtId)}
            onToggle={() => toggleExpanded(thoughtId)}
          />
        );
        currentThoughtDuration = 0;
        thoughtSteps = [];
      }
    };

    steps.forEach((step, index) => {
      const stepId = step.id || `step-${index}`;
      
      // Handle thought steps - accumulate duration
      if (step.type === 'thought' || step.type === 'analyze') {
        if (step.status === 'complete') {
          currentThoughtDuration += step.duration || 2000;
          thoughtSteps.push(step);
        } else if (step.status === 'running') {
          // Show running thought as live indicator
          items.push(
            <div key={stepId} className="timeline-thought-running">
              <Loader2 className="w-3 h-3 animate-spin inline mr-2 text-[#6e7681]" />
              <span className="text-[#6e7681]">Thinking...</span>
            </div>
          );
        }
        return;
      }

      // Flush any accumulated thought before other items
      flushThought();

      // Render based on step type
      switch (step.type) {
        case 'search':
          if (step.status === 'running') {
            items.push(
              <ToolBlock key={stepId} step={step} />
            );
          } else {
            // Completed search - show as expandable
            const searchQuery = step.description.replace('Searching the web for ', '').replace(/"/g, '');
            items.push(
              <ExpandableLine
                key={stepId}
                prefix="Searched"
                main={searchQuery.length > 40 ? searchQuery.substring(0, 40) + '...' : searchQuery}
                suffix={step.details}
                isExpanded={expandedItems.has(stepId)}
                onToggle={() => toggleExpanded(stepId)}
              />
            );
          }
          break;

        case 'read':
          if (step.status === 'running') {
            items.push(
              <div key={stepId} className="timeline-text">
                <Loader2 className="w-3 h-3 animate-spin inline mr-2" />
                {step.description}
              </div>
            );
          } else {
            items.push(
              <ExpandableLine
                key={stepId}
                prefix="Read"
                main={step.description.replace('Reading ', '').replace(' content', '')}
                suffix={step.details}
                isExpanded={expandedItems.has(stepId)}
                onToggle={() => toggleExpanded(stepId)}
              />
            );
          }
          break;

        case 'tool':
          items.push(
            <ToolBlock key={stepId} step={step} />
          );
          break;

        case 'create':
          if (step.status === 'running') {
            items.push(
              <ToolBlock key={stepId} step={step} />
            );
          } else {
            items.push(
              <ExpandableLine
                key={stepId}
                prefix="Created"
                main={step.details || step.description}
                isExpanded={expandedItems.has(stepId)}
                onToggle={() => toggleExpanded(stepId)}
              />
            );
          }
          break;

        case 'write':
          if (step.status === 'running') {
            items.push(
              <div key={stepId} className="timeline-text">
                <Loader2 className="w-3 h-3 animate-spin inline mr-2" />
                {step.description}
              </div>
            );
          } else {
            items.push(
              <ExpandableLine
                key={stepId}
                prefix="Edited"
                main="block content"
                suffix={step.details}
                isExpanded={expandedItems.has(stepId)}
                onToggle={() => toggleExpanded(stepId)}
              />
            );
          }
          break;

        default:
          // Plain text line
          items.push(
            <div key={stepId} className="timeline-text">
              {step.status === 'running' && (
                <Loader2 className="w-3 h-3 animate-spin inline mr-2" />
              )}
              {step.description}
            </div>
          );
      }
    });

    // Flush any remaining thought
    flushThought();

    return items;
  };

  // Find current running step for live indicator
  const runningStep = steps.find(s => s.status === 'running');

  return (
    <div className="progress-timeline">
      {renderTimeline()}
      
      {/* Live typing indicator */}
      {isLive && runningStep && (
        <CurrentAction text={runningStep.description} />
      )}
    </div>
  );
};

export default ProgressTimeline;
