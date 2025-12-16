import React, { useState } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import { ReflectionMood, getMoodEmoji } from '@/types/dashboard';
import { Send, Clock, Loader2, Check } from 'lucide-react';

interface ReflectionSectionProps {
  isVisible: boolean;
}

const MOOD_OPTIONS: { value: ReflectionMood; label: string }[] = [
  { value: 'great', label: 'Great' },
  { value: 'good', label: 'Good' },
  { value: 'okay', label: 'Okay' },
  { value: 'struggling', label: 'Hard' },
  { value: 'overwhelmed', label: 'Tough' },
];

const ReflectionSection: React.FC<ReflectionSectionProps> = ({ isVisible }) => {
  const {
    todayReflection,
    submitReflection,
    isProcessingReflection,
  } = useDashboardStore();

  const [reflectionText, setReflectionText] = useState('');
  const [selectedMood, setSelectedMood] = useState<ReflectionMood | null>(null);

  if (!isVisible) {
    return (
      <section className="dashboard-section collapsed">
        <div className="section-header muted">
          <h2 className="section-title">REFLECTION</h2>
          <span className="section-badge time-badge">
            <Clock className="w-3 h-3" />
            Available at 10:00 PM
          </span>
        </div>
      </section>
    );
  }

  // Already submitted reflection for today
  if (todayReflection && todayReflection.content) {
    return (
      <section className="dashboard-section reflection submitted">
        <div className="section-header">
          <h2 className="section-title">REFLECTION</h2>
          <span className="section-badge submitted">
            <Check className="w-3 h-3" />
            Submitted
          </span>
        </div>

        <div className="reflection-submitted">
          <div className="reflection-submitted-content">
            {todayReflection.mood && (
              <span className="reflection-mood-badge">
                {getMoodEmoji(todayReflection.mood)}
              </span>
            )}
            <p>{todayReflection.content}</p>
          </div>

          {todayReflection.aiInsights && (
            <div className="reflection-ai-response">
              <span className="reflection-ai-label">AI</span>
              <p>{todayReflection.aiInsights}</p>
            </div>
          )}
        </div>
      </section>
    );
  }

  const handleSubmit = () => {
    if (!reflectionText.trim()) return;
    submitReflection(reflectionText.trim(), selectedMood || undefined);
    setReflectionText('');
    setSelectedMood(null);
  };

  return (
    <section className="dashboard-section reflection">
      <div className="section-header">
        <h2 className="section-title">REFLECTION</h2>
      </div>

      <div className="reflection-input-container">
        <p className="reflection-prompt">How did today go?</p>

        {/* Mood selector */}
        <div className="mood-selector">
          {MOOD_OPTIONS.map((mood) => (
            <button
              key={mood.value}
              className={`mood-btn ${selectedMood === mood.value ? 'selected' : ''}`}
              onClick={() => setSelectedMood(mood.value)}
            >
              <span className="mood-emoji">{getMoodEmoji(mood.value)}</span>
              <span className="mood-label">{mood.label}</span>
            </button>
          ))}
        </div>

        {/* Text input */}
        <div className="reflection-input-wrapper">
          <textarea
            className="reflection-input"
            placeholder="Share your thoughts about today's learning..."
            value={reflectionText}
            onChange={(e) => setReflectionText(e.target.value)}
            rows={3}
            disabled={isProcessingReflection}
          />
          <button
            className={`reflection-submit-btn ${reflectionText.trim() ? 'active' : ''}`}
            onClick={handleSubmit}
            disabled={!reflectionText.trim() || isProcessingReflection}
          >
            {isProcessingReflection ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </section>
  );
};

export default ReflectionSection;
