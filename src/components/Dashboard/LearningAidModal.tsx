import React from 'react';
import {
  X,
  BookOpen,
  Brain,
  PenTool,
  Lightbulb,
  Link2,
  Sparkles,
  HelpCircle,
  FileText,
  ListChecks,
  MessageSquare,
  Zap,
  ArrowRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export type LearningAidType = 
  | 'flashcards'
  | 'mindmap'
  | 'exercises'
  | 'concepts'
  | 'resources'
  | 'summary'
  | 'quiz'
  | 'cheatsheet'
  | 'notes'
  | 'explain'
  | 'deep-dive';

interface LearningAidInfo {
  type: LearningAidType;
  title: string;
  description: string;
  benefits: string[];
  estimatedTime: string;
  icon: React.ReactNode;
  color: string;
  actions: { label: string; primary?: boolean }[];
}

const LEARNING_AIDS: Record<LearningAidType, LearningAidInfo> = {
  flashcards: {
    type: 'flashcards',
    title: 'Flashcards',
    description: 'AI-generated flashcards from your notes to help you memorize key concepts, definitions, and formulas using spaced repetition.',
    benefits: [
      'Memorize key terms and definitions',
      'Spaced repetition for long-term retention',
      'Track which cards you struggle with',
      'Auto-generated from your notes',
    ],
    estimatedTime: '10-15 min',
    icon: <BookOpen className="w-6 h-6" />,
    color: '#a371f7',
    actions: [
      { label: 'Study Now', primary: true },
      { label: 'Preview Cards' },
    ],
  },
  mindmap: {
    type: 'mindmap',
    title: 'Mind Map',
    description: 'Visual representation of how concepts connect to each other. See the big picture and understand relationships between ideas.',
    benefits: [
      'Visualize concept relationships',
      'Understand the big picture',
      'Identify knowledge gaps',
      'Interactive exploration',
    ],
    estimatedTime: '5-10 min',
    icon: <Brain className="w-6 h-6" />,
    color: '#58a6ff',
    actions: [
      { label: 'View Map', primary: true },
      { label: 'Export Image' },
    ],
  },
  exercises: {
    type: 'exercises',
    title: 'Practice Problems',
    description: 'Hands-on exercises and coding problems based on your current topic. Apply what you learned with guided practice.',
    benefits: [
      'Apply theoretical knowledge',
      'Get immediate feedback',
      'Difficulty adapts to your level',
      'Step-by-step solutions available',
    ],
    estimatedTime: '20-30 min',
    icon: <PenTool className="w-6 h-6" />,
    color: '#3fb950',
    actions: [
      { label: 'Start Practice', primary: true },
      { label: 'View Solutions' },
    ],
  },
  concepts: {
    type: 'concepts',
    title: 'Key Concepts',
    description: 'Deep dive into the most important concepts you need to understand. Each concept explained clearly with examples.',
    benefits: [
      'Focus on what matters most',
      'Clear explanations with examples',
      'Build strong foundations',
      'Prerequisites highlighted',
    ],
    estimatedTime: '15-20 min',
    icon: <Lightbulb className="w-6 h-6" />,
    color: '#d29922',
    actions: [
      { label: 'Explore Concepts', primary: true },
      { label: 'Mark as Known' },
    ],
  },
  resources: {
    type: 'resources',
    title: 'Curated Resources',
    description: 'Handpicked papers, tutorials, videos, and articles related to your current topic. Quality over quantity.',
    benefits: [
      'Save time finding good resources',
      'Curated for relevance',
      'Different formats (video, text, etc.)',
      'Difficulty levels indicated',
    ],
    estimatedTime: 'Varies',
    icon: <Link2 className="w-6 h-6" />,
    color: '#ff7b72',
    actions: [
      { label: 'Browse Resources', primary: true },
      { label: 'Add Your Own' },
    ],
  },
  summary: {
    type: 'summary',
    title: 'AI Summary',
    description: 'Get a concise summary of your current topic or notes. Perfect for quick review before moving on.',
    benefits: [
      'Quick recap of key points',
      'Highlight what you should remember',
      'Great for review sessions',
      'Customizable detail level',
    ],
    estimatedTime: '3-5 min',
    icon: <Sparkles className="w-6 h-6" />,
    color: '#38bdf8',
    actions: [
      { label: 'Generate Summary', primary: true },
      { label: 'Detailed Version' },
    ],
  },
  quiz: {
    type: 'quiz',
    title: 'Quiz Me',
    description: 'Test your understanding with AI-generated questions. Multiple choice, true/false, and short answer questions.',
    benefits: [
      'Test your understanding',
      'Identify weak areas',
      'Get explanations for wrong answers',
      'Track improvement over time',
    ],
    estimatedTime: '10-15 min',
    icon: <HelpCircle className="w-6 h-6" />,
    color: '#f472b6',
    actions: [
      { label: 'Start Quiz', primary: true },
      { label: 'Quick 5 Questions' },
    ],
  },
  cheatsheet: {
    type: 'cheatsheet',
    title: 'Cheat Sheet',
    description: 'A compact reference sheet with formulas, syntax, and key information. Print it or keep it handy.',
    benefits: [
      'Quick reference while working',
      'All important info in one place',
      'Printable format',
      'Searchable content',
    ],
    estimatedTime: '2-3 min',
    icon: <FileText className="w-6 h-6" />,
    color: '#a3e635',
    actions: [
      { label: 'View Cheat Sheet', primary: true },
      { label: 'Download PDF' },
    ],
  },
  notes: {
    type: 'notes',
    title: 'Key Points',
    description: 'Bullet-pointed list of the most important takeaways from your current topic. No fluff, just essentials.',
    benefits: [
      'Distilled key information',
      'Easy to scan and review',
      'Perfect for last-minute review',
      'Exportable to your notes',
    ],
    estimatedTime: '3-5 min',
    icon: <ListChecks className="w-6 h-6" />,
    color: '#fbbf24',
    actions: [
      { label: 'View Key Points', primary: true },
      { label: 'Add to Notes' },
    ],
  },
  explain: {
    type: 'explain',
    title: 'Explain Like I\'m 5',
    description: 'Get a simple, intuitive explanation of complex concepts. Uses analogies and everyday examples.',
    benefits: [
      'Understand difficult concepts',
      'Real-world analogies',
      'Build intuition first',
      'Ask follow-up questions',
    ],
    estimatedTime: '5-10 min',
    icon: <MessageSquare className="w-6 h-6" />,
    color: '#818cf8',
    actions: [
      { label: 'Explain This', primary: true },
      { label: 'More Technical' },
    ],
  },
  'deep-dive': {
    type: 'deep-dive',
    title: 'Deep Dive',
    description: 'Go beyond the basics. Explore advanced topics, edge cases, and implementation details.',
    benefits: [
      'Master advanced concepts',
      'Understand edge cases',
      'Learn best practices',
      'Expert-level knowledge',
    ],
    estimatedTime: '30-45 min',
    icon: <Zap className="w-6 h-6" />,
    color: '#ec4899',
    actions: [
      { label: 'Start Deep Dive', primary: true },
      { label: 'Prerequisites' },
    ],
  },
};

interface LearningAidModalProps {
  aidType: LearningAidType | null;
  onClose: () => void;
  onAction?: (aidType: LearningAidType, action: string) => void;
}

const LearningAidModal: React.FC<LearningAidModalProps> = ({
  aidType,
  onClose,
  onAction,
}) => {
  if (!aidType) return null;

  const aid = LEARNING_AIDS[aidType];

  const handleAction = (actionLabel: string) => {
    onAction?.(aidType, actionLabel);
    onClose();
  };

  return (
    <div className="learning-aid-modal-overlay" onClick={onClose}>
      <div
        className="learning-aid-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="learning-aid-modal-header">
          <div
            className="learning-aid-modal-icon"
            style={{ backgroundColor: `${aid.color}20`, color: aid.color }}
          >
            {aid.icon}
          </div>
          <div className="learning-aid-modal-title-section">
            <h2 className="learning-aid-modal-title">{aid.title}</h2>
            <div className="learning-aid-modal-time">
              <Clock className="w-3.5 h-3.5" />
              <span>{aid.estimatedTime}</span>
            </div>
          </div>
          <button className="learning-aid-modal-close" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        <p className="learning-aid-modal-description">{aid.description}</p>

        {/* Benefits */}
        <div className="learning-aid-modal-benefits">
          <h3 className="learning-aid-modal-benefits-title">What you'll get:</h3>
          <ul className="learning-aid-modal-benefits-list">
            {aid.benefits.map((benefit, index) => (
              <li key={index}>
                <CheckCircle2
                  className="w-4 h-4"
                  style={{ color: aid.color }}
                />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="learning-aid-modal-actions">
          {aid.actions.map((action, index) => (
            <button
              key={index}
              className={`learning-aid-modal-btn ${action.primary ? 'primary' : 'secondary'}`}
              style={action.primary ? { backgroundColor: aid.color } : undefined}
              onClick={() => handleAction(action.label)}
            >
              <span>{action.label}</span>
              {action.primary && <ArrowRight className="w-4 h-4" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LearningAidModal;
