import React, { useState, useEffect } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Search, 
  FileText, 
  Wrench, 
  Brain, 
  PenLine,
  Plus,
  Check,
  Loader2,
  AlertCircle
} from 'lucide-react';
import type { ThinkingStep, ThinkingStepType, ThinkingStepStatus } from '@/store/aiStore';

interface ThinkingBlockProps {
  steps: ThinkingStep[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isLive?: boolean; // true when AI is still generating
}

// Icon mapping for different step types
const stepIcons: Record<ThinkingStepType, React.ElementType> = {
  search: Search,
  read: FileText,
  tool: Wrench,
  analyze: Brain,
  write: PenLine,
  create: Plus,
};

// Status icon component
const StatusIcon: React.FC<{ status: ThinkingStepStatus }> = ({ status }) => {
  switch (status) {
    case 'running':
      return <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />;
    case 'complete':
      return <Check className="w-3 h-3 text-green-400" />;
    case 'error':
      return <AlertCircle className="w-3 h-3 text-red-400" />;
  }
};

// Format duration in human-readable form
const formatDuration = (ms?: number): string => {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

// Get summary text for collapsed view
const getSummaryText = (steps: ThinkingStep[]): string => {
  const completedSteps = steps.filter(s => s.status === 'complete').length;
  const runningSteps = steps.filter(s => s.status === 'running').length;
  
  if (runningSteps > 0) {
    return `Thinking... (${completedSteps}/${steps.length} steps)`;
  }
  return `Completed ${steps.length} step${steps.length !== 1 ? 's' : ''}`;
};

const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  steps,
  isExpanded = false,
  onToggleExpand,
  isLive = false,
}) => {
  const [localExpanded, setLocalExpanded] = useState(isExpanded);
  
  // Auto-expand when live and receiving steps
  useEffect(() => {
    if (isLive && steps.length > 0) {
      setLocalExpanded(true);
    }
  }, [isLive, steps.length]);

  // Sync with external expanded state
  useEffect(() => {
    setLocalExpanded(isExpanded);
  }, [isExpanded]);

  if (steps.length === 0) return null;

  const handleToggle = () => {
    const newExpanded = !localExpanded;
    setLocalExpanded(newExpanded);
    onToggleExpand?.();
  };

  const hasRunningStep = steps.some(s => s.status === 'running');
  const totalDuration = steps.reduce((acc, s) => acc + (s.duration || 0), 0);

  return (
    <div className="thinking-block mb-3">
      {/* Header - always visible */}
      <button
        onClick={handleToggle}
        className="thinking-header w-full flex items-center gap-2 px-3 py-2 bg-[#161b22]/80 hover:bg-[#1c2128] border border-[#30363d]/50 rounded-lg transition-all duration-200 group"
      >
        {/* Expand/collapse icon */}
        <span className="text-[#8b949e] group-hover:text-[#c9d1d9] transition-colors">
          {localExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>

        {/* Brain icon with animation when thinking */}
        <span className={`${hasRunningStep ? 'animate-pulse' : ''}`}>
          <Brain className={`w-4 h-4 ${hasRunningStep ? 'text-blue-400' : 'text-[#8b949e]'}`} />
        </span>

        {/* Summary text */}
        <span className={`text-sm font-medium ${hasRunningStep ? 'text-blue-400' : 'text-[#8b949e]'}`}>
          {getSummaryText(steps)}
        </span>

        {/* Duration badge */}
        {totalDuration > 0 && !hasRunningStep && (
          <span className="ml-auto text-xs text-[#6e7681] bg-[#21262d] px-2 py-0.5 rounded">
            {formatDuration(totalDuration)}
          </span>
        )}

        {/* Live indicator */}
        {isLive && hasRunningStep && (
          <span className="ml-auto flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="text-xs text-blue-400">Live</span>
          </span>
        )}
      </button>

      {/* Expanded content */}
      {localExpanded && (
        <div className="thinking-steps mt-1 ml-3 pl-3 border-l-2 border-[#30363d]/50 space-y-1 animate-in slide-in-from-top-2 duration-200">
          {steps.map((step, index) => {
            const Icon = stepIcons[step.type] || Wrench;
            
            return (
              <div
                key={step.id}
                className={`thinking-step flex items-start gap-2 py-1.5 px-2 rounded transition-all duration-200 ${
                  step.status === 'running' ? 'bg-blue-500/5' : ''
                }`}
              >
                {/* Step number */}
                <span className="text-xs text-[#6e7681] font-mono w-4 shrink-0 pt-0.5">
                  {index + 1}.
                </span>

                {/* Type icon */}
                <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                  step.status === 'running' ? 'text-blue-400' :
                  step.status === 'complete' ? 'text-[#8b949e]' :
                  'text-red-400'
                }`} />

                {/* Description and details */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-tight ${
                    step.status === 'running' ? 'text-[#c9d1d9]' : 'text-[#8b949e]'
                  }`}>
                    {step.description}
                  </p>
                  {step.details && (
                    <p className="text-xs text-[#6e7681] mt-0.5 truncate">
                      {step.details}
                    </p>
                  )}
                </div>

                {/* Status and duration */}
                <div className="flex items-center gap-2 shrink-0">
                  {step.duration && step.status === 'complete' && (
                    <span className="text-xs text-[#6e7681]">
                      {formatDuration(step.duration)}
                    </span>
                  )}
                  <StatusIcon status={step.status} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ThinkingBlock;







