import React, { useState, useMemo } from 'react';
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import type { DatabaseBlockData } from '@/types';
import {
  analyzeDatabase,
  detectPatterns,
  type AnalysisResult,
  type PatternDetectionResult,
} from './DatabaseAITools';

interface AIAnalysisPanelProps {
  dbData: DatabaseBlockData;
  isExpanded?: boolean;
  onToggle?: () => void;
}

const AIAnalysisPanel: React.FC<AIAnalysisPanelProps> = ({
  dbData,
  isExpanded: externalExpanded,
  onToggle,
}) => {
  const [internalExpanded, setInternalExpanded] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'insights' | 'patterns' | 'stats'>('insights');

  const isExpanded = externalExpanded !== undefined ? externalExpanded : internalExpanded;
  const handleToggle = onToggle || (() => setInternalExpanded(!internalExpanded));

  // Perform analysis
  const analysis: AnalysisResult = useMemo(() => {
    setIsAnalyzing(true);
    const result = analyzeDatabase(dbData, {
      include_patterns: true,
      include_recommendations: true,
    });
    setTimeout(() => setIsAnalyzing(false), 300);
    return result;
  }, [dbData]);

  const patterns = useMemo(() => {
    return detectPatterns(dbData);
  }, [dbData]);

  // Categorize patterns by severity
  const criticalPatterns = patterns.filter(p => p.severity === 'high');
  const warningPatterns = patterns.filter(p => p.severity === 'medium');
  const infoPatterns = patterns.filter(p => p.severity === 'low');

  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          <span className="font-semibold text-purple-300">AI Analysis</span>
          {isAnalyzing && (
            <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
          )}
          {!isExpanded && criticalPatterns.length > 0 && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-300 text-xs rounded-full">
              {criticalPatterns.length} issue{criticalPatterns.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button className="p-1 hover:bg-white/10 rounded transition-colors">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-purple-500/20">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-2 bg-black/20">
            <button
              onClick={() => setActiveTab('insights')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-all ${
                activeTab === 'insights'
                  ? 'bg-purple-500/30 text-purple-200'
                  : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Insights
            </button>
            <button
              onClick={() => setActiveTab('patterns')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-all ${
                activeTab === 'patterns'
                  ? 'bg-purple-500/30 text-purple-200'
                  : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Patterns
              {patterns.length > 0 && (
                <span className="px-1.5 py-0.5 bg-purple-500/30 text-purple-200 text-xs rounded-full">
                  {patterns.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-all ${
                activeTab === 'stats'
                  ? 'bg-purple-500/30 text-purple-200'
                  : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Statistics
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-3 max-h-[400px] overflow-y-auto custom-scrollbar">
            {/* Insights Tab */}
            {activeTab === 'insights' && (
              <div className="space-y-3">
                {/* Summary */}
                <div className="flex items-start gap-2 p-2 bg-purple-500/10 rounded">
                  <Brain className="w-4 h-4 text-purple-300 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-purple-100">{analysis.summary}</p>
                </div>

                {/* Insights */}
                {analysis.insights && analysis.insights.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Key Insights
                    </h4>
                    {analysis.insights.map((insight, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-sm text-blue-100"
                      >
                        <Lightbulb className="w-3.5 h-3.5 text-blue-300 mt-0.5 flex-shrink-0" />
                        <span>{insight}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recommendations */}
                {analysis.recommendations && analysis.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Recommendations
                    </h4>
                    {analysis.recommendations.map((rec, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded text-sm text-green-100"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-green-300 mt-0.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {(!analysis.insights || analysis.insights.length === 0) &&
                  (!analysis.recommendations || analysis.recommendations.length === 0) && (
                    <div className="text-center py-8 text-gray-500">
                      <Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Add data to see AI insights</p>
                    </div>
                  )}
              </div>
            )}

            {/* Patterns Tab */}
            {activeTab === 'patterns' && (
              <div className="space-y-3">
                {/* Critical Patterns */}
                {criticalPatterns.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wide flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Critical Issues
                    </h4>
                    {criticalPatterns.map((pattern, idx) => (
                      <PatternCard key={idx} pattern={pattern} />
                    ))}
                  </div>
                )}

                {/* Warning Patterns */}
                {warningPatterns.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-yellow-400 uppercase tracking-wide flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Warnings
                    </h4>
                    {warningPatterns.map((pattern, idx) => (
                      <PatternCard key={idx} pattern={pattern} />
                    ))}
                  </div>
                )}

                {/* Info Patterns */}
                {infoPatterns.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wide flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Trends & Patterns
                    </h4>
                    {infoPatterns.map((pattern, idx) => (
                      <PatternCard key={idx} pattern={pattern} />
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {patterns.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No patterns detected yet</p>
                    <p className="text-xs mt-1">Add more data to see trends and anomalies</p>
                  </div>
                )}
              </div>
            )}

            {/* Statistics Tab */}
            {activeTab === 'stats' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {/* Total Rows */}
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded">
                    <div className="text-xs text-blue-300 mb-1">Total Rows</div>
                    <div className="text-2xl font-bold text-blue-100">{dbData.rows.length}</div>
                  </div>

                  {/* Total Columns */}
                  <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded">
                    <div className="text-xs text-purple-300 mb-1">Columns</div>
                    <div className="text-2xl font-bold text-purple-100">{dbData.columns.length}</div>
                  </div>
                </div>

                {/* Column Statistics */}
                {Object.entries(analysis.statistics).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Column Details
                    </h4>
                    {Object.entries(analysis.statistics).map(([colName, stats]) => (
                      <StatisticsCard key={colName} columnName={colName} stats={stats} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Pattern Card Component
const PatternCard: React.FC<{ pattern: PatternDetectionResult }> = ({ pattern }) => {
  const severityColors = {
    high: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-200',
      icon: 'text-red-400',
    },
    medium: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      text: 'text-yellow-200',
      icon: 'text-yellow-400',
    },
    low: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      text: 'text-blue-200',
      icon: 'text-blue-400',
    },
  };

  const colors = severityColors[pattern.severity];

  const getIcon = () => {
    switch (pattern.type) {
      case 'anomaly':
        return <AlertTriangle className={`w-4 h-4 ${colors.icon} flex-shrink-0`} />;
      case 'trend':
        return <TrendingUp className={`w-4 h-4 ${colors.icon} flex-shrink-0`} />;
      case 'duplicate':
        return <AlertTriangle className={`w-4 h-4 ${colors.icon} flex-shrink-0`} />;
      case 'missing':
        return <AlertTriangle className={`w-4 h-4 ${colors.icon} flex-shrink-0`} />;
      default:
        return <BarChart3 className={`w-4 h-4 ${colors.icon} flex-shrink-0`} />;
    }
  };

  return (
    <div className={`p-2 ${colors.bg} border ${colors.border} rounded`}>
      <div className="flex items-start gap-2">
        {getIcon()}
        <div className="flex-1 min-w-0">
          {pattern.column && (
            <div className="text-xs font-medium text-gray-400 mb-0.5">
              {pattern.column}
            </div>
          )}
          <div className={`text-sm ${colors.text}`}>{pattern.description}</div>
          {pattern.affected_rows !== undefined && (
            <div className="text-xs text-gray-500 mt-1">
              Affects {pattern.affected_rows} row{pattern.affected_rows !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Statistics Card Component
const StatisticsCard: React.FC<{ columnName: string; stats: any }> = ({ columnName, stats }) => {
  return (
    <div className="p-2 bg-gray-800/50 border border-gray-700 rounded">
      <div className="font-medium text-sm text-gray-300 mb-2">{columnName}</div>

      <div className="space-y-1 text-xs">
        {/* Number stats */}
        {stats.count !== undefined && (
          <>
            <div className="flex justify-between">
              <span className="text-gray-500">Count:</span>
              <span className="text-gray-300">{stats.count}</span>
            </div>
            {stats.avg !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-500">Average:</span>
                <span className="text-gray-300">{stats.avg.toFixed(2)}</span>
              </div>
            )}
            {stats.min !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-500">Min / Max:</span>
                <span className="text-gray-300">
                  {stats.min} / {stats.max}
                </span>
              </div>
            )}
            {stats.sum !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-500">Sum:</span>
                <span className="text-gray-300">{stats.sum}</span>
              </div>
            )}
          </>
        )}

        {/* Checkbox stats */}
        {stats.trueCount !== undefined && (
          <>
            <div className="flex justify-between">
              <span className="text-gray-500">Checked:</span>
              <span className="text-gray-300">{stats.trueCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Percentage:</span>
              <span className="text-gray-300">{stats.percentage.toFixed(0)}%</span>
            </div>
          </>
        )}

        {/* Distribution stats */}
        {stats.distribution && (
          <div className="mt-2">
            <div className="text-gray-500 mb-1">Distribution:</div>
            {Object.entries(stats.distribution)
              .slice(0, 3)
              .map(([value, count]) => (
                <div key={value} className="flex justify-between pl-2">
                  <span className="text-gray-400 truncate">{value}:</span>
                  <span className="text-gray-300">{count as number}</span>
                </div>
              ))}
            {Object.keys(stats.distribution).length > 3 && (
              <div className="text-gray-500 text-xs pl-2 mt-1">
                +{Object.keys(stats.distribution).length - 3} more...
              </div>
            )}
          </div>
        )}

        {/* Date range stats */}
        {stats.earliest && (
          <>
            <div className="flex justify-between">
              <span className="text-gray-500">Earliest:</span>
              <span className="text-gray-300">
                {new Date(stats.earliest).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Latest:</span>
              <span className="text-gray-300">
                {new Date(stats.latest).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Span:</span>
              <span className="text-gray-300">{stats.span} days</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AIAnalysisPanel;
