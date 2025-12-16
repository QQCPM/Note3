import React from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import { DashboardRecommendation } from '@/types/dashboard';
import { Loader2, BookOpen, Brain, PenTool, Lightbulb, Link2 } from 'lucide-react';

const RecommendationCards: React.FC = () => {
  const { recommendations, currentInsight } = useDashboardStore();

  const getRecommendationIcon = (type: DashboardRecommendation['type']) => {
    switch (type) {
      case 'flashcards':
        return <BookOpen className="w-4 h-4" />;
      case 'mindmap':
        return <Brain className="w-4 h-4" />;
      case 'exercises':
        return <PenTool className="w-4 h-4" />;
      case 'concepts':
        return <Lightbulb className="w-4 h-4" />;
      case 'resources':
        return <Link2 className="w-4 h-4" />;
      default:
        return <BookOpen className="w-4 h-4" />;
    }
  };

  const getRecommendationColor = (type: DashboardRecommendation['type']) => {
    switch (type) {
      case 'flashcards':
        return 'flashcards';
      case 'mindmap':
        return 'mindmap';
      case 'exercises':
        return 'exercises';
      case 'concepts':
        return 'concepts';
      case 'resources':
        return 'resources';
      default:
        return 'default';
    }
  };

  return (
    <section className="dashboard-section recommendations">
      <div className="section-header">
        <h2 className="section-title">FOR YOU</h2>
      </div>

      <div className="recommendation-cards">
        {recommendations.map((rec) => (
          <button
            key={rec.id}
            className={`recommendation-card ${getRecommendationColor(rec.type)}`}
            disabled={rec.isLoading}
          >
            <div className="recommendation-icon">
              {rec.isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                getRecommendationIcon(rec.type)
              )}
            </div>
            <div className="recommendation-content">
              <span className="recommendation-title">
                {rec.title}
                {rec.count && <span className="recommendation-count">{rec.count}</span>}
              </span>
              <span className="recommendation-subtitle">{rec.subtitle}</span>
            </div>
          </button>
        ))}
      </div>

      {/* AI Insight (smaller, at bottom of recommendations) */}
      {currentInsight && !currentInsight.dismissed && (
        <div className="recommendation-insight">
          <div className="insight-icon">
            <Lightbulb className="w-3.5 h-3.5" />
          </div>
          <p className="insight-text">{currentInsight.content}</p>
        </div>
      )}
    </section>
  );
};

export default RecommendationCards;
