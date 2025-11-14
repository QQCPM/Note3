import React, { useState, useRef, useEffect } from 'react';
import { Search, Sparkles, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { DatabaseBlockData, DatabaseRowData } from '@/types';
import { queryDatabase, type QueryResult } from './DatabaseAITools';

interface AIQueryBarProps {
  dbData: DatabaseBlockData;
  onResultsFilter?: (rows: DatabaseRowData[] | null) => void;
  className?: string;
}

const AIQueryBar: React.FC<AIQueryBarProps> = ({ dbData, onResultsFilter, className = '' }) => {
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Example queries based on database structure
  const suggestions = generateSuggestions(dbData);

  const handleQuery = async () => {
    if (!query.trim() || isProcessing) return;

    setIsProcessing(true);
    setShowSuggestions(false);

    try {
      // Simulate async processing (in real implementation, this would call AI service)
      await new Promise(resolve => setTimeout(resolve, 500));

      const queryResult = queryDatabase(dbData, query);
      setResult(queryResult);

      // Apply filter if rows returned
      if (queryResult.rows && onResultsFilter) {
        onResultsFilter(queryResult.rows);
      }
    } catch (error) {
      console.error('Query error:', error);
      setResult({
        explanation: 'Failed to process query',
        summary: 'An error occurred',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResult(null);
    if (onResultsFilter) {
      onResultsFilter(null);
    }
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleQuery();
    } else if (e.key === 'Escape') {
      handleClear();
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    // Show suggestions when focused and empty
    if (query === '' && document.activeElement === inputRef.current) {
      setShowSuggestions(true);
    }
  }, [query]);

  return (
    <div className={`relative ${className}`}>
      {/* Query Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <Search className="w-4 h-4 text-gray-500" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query === '' && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="Ask AI about your data... (e.g., 'show all active items', 'what's the average price?')"
          className="w-full pl-16 pr-24 py-2.5 bg-[#0d1117] border border-purple-500/30 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
          disabled={isProcessing}
        />

        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {isProcessing && <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />}

          {query && !isProcessing && (
            <button
              onClick={handleClear}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title="Clear"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}

          <button
            onClick={handleQuery}
            disabled={!query.trim() || isProcessing}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-all"
          >
            Ask
          </button>
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#161b22] border border-purple-500/30 rounded-lg shadow-lg z-10 overflow-hidden">
          <div className="p-2 border-b border-gray-700">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Try asking:
            </div>
          </div>
          <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left px-3 py-2 hover:bg-purple-500/10 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-purple-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                  <span className="text-sm text-gray-300 group-hover:text-purple-200">
                    {suggestion}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Query Result */}
      {result && !isProcessing && (
        <div className="mt-2 animate-fadeIn">
          <div
            className={`p-3 rounded-lg border ${
              result.rows || result.summary || result.statistics
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-blue-500/10 border-blue-500/30'
            }`}
          >
            {/* Icon & Explanation */}
            <div className="flex items-start gap-2 mb-2">
              {result.rows || result.summary || result.statistics ? (
                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-sm text-gray-200">{result.explanation}</p>
              </div>
            </div>

            {/* Results Summary */}
            {result.summary && (
              <div className="mt-2 p-2 bg-black/20 rounded border border-white/5">
                <p className="text-sm font-medium text-green-300">{result.summary}</p>
              </div>
            )}

            {/* Row Count */}
            {result.count !== undefined && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-500">Result count:</span>
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs font-medium rounded-full">
                  {result.count} row{result.count !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Statistics */}
            {result.statistics !== undefined && result.statistics !== null && (
              <div className="mt-2 p-2 bg-black/20 rounded border border-white/5">
                <div className="text-xs text-gray-500 mb-1">Calculated result:</div>
                <div className="text-2xl font-bold text-purple-300">
                  {typeof result.statistics === 'number'
                    ? result.statistics.toFixed(2)
                    : JSON.stringify(result.statistics)}
                </div>
              </div>
            )}

            {/* Applied Filter Notice */}
            {result.rows && result.rows.length > 0 && (
              <div className="mt-2 p-2 bg-purple-500/10 border border-purple-500/20 rounded">
                <p className="text-xs text-purple-200">
                  ✨ Filter applied to table view. Click X to clear.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Generate query suggestions based on database structure
 */
function generateSuggestions(dbData: DatabaseBlockData): string[] {
  const suggestions: string[] = [];

  if (dbData.rows.length === 0) {
    return ['How many rows do I have?'];
  }

  // Always include count
  suggestions.push('How many rows are there?');

  // Suggestions based on column types
  dbData.columns.forEach(col => {
    if (col.type === 'number') {
      suggestions.push(`What's the average ${col.name}?`);
      suggestions.push(`What's the total ${col.name}?`);
    } else if (col.type === 'select') {
      if (col.options && col.options.length > 0) {
        const firstOption = col.options[0];
        suggestions.push(`Show all rows where ${col.name} is ${firstOption}`);
      }
    } else if (col.type === 'date') {
      suggestions.push(`Show entries from ${col.name}`);
    } else if (col.type === 'checkbox') {
      suggestions.push(`How many have ${col.name} checked?`);
    }
  });

  // Limit to 5 suggestions
  return suggestions.slice(0, 5);
}

export default AIQueryBar;
