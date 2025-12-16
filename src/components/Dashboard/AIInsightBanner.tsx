import React from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import { AIInsight } from '@/types/dashboard';
import { Lightbulb, X, AlertTriangle, TrendingUp, Info } from 'lucide-react';

interface AIInsightBannerProps {
  insight: AIInsight;
}

const AIInsightBanner: React.FC<AIInsightBannerProps> = ({ insight }) => {
  const { dismissInsight } = useDashboardStore();

  const getInsightIcon = () => {
    switch (insight.type) {
      case 'tip':
        return <Lightbulb className="w-4 h-4" />;
      case 'observation':
        return <TrendingUp className="w-4 h-4" />;
      case 'suggestion':
        return <Info className="w-4 h-4" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Lightbulb className="w-4 h-4" />;
    }
  };

  return (
    <div className={`ai-insight-banner ${insight.type} ${insight.priority}`}>
      <div className="insight-banner-icon">
        {getInsightIcon()}
      </div>
      <p className="insight-banner-text">{insight.content}</p>
      <button
        className="insight-banner-dismiss"
        onClick={dismissInsight}
        aria-label="Dismiss insight"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default AIInsightBanner;
