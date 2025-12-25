// Recommendation data types for AI-generated content

export interface MindmapNode {
  id: string;
  label: string;
  children?: MindmapNode[];
}

export interface MindmapData {
  center: string;
  nodes: MindmapNode[];
}

export interface FlashcardData {
  question: string;
  answer: string;
}

export interface ConceptData {
  title: string;
  description: string;
}

export interface ExerciseData {
  title: string;
  description: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export interface ResourceData {
  type: 'Book' | 'Course' | 'Video' | 'Paper' | 'Tutorial' | 'Interactive' | 'Article' | 'Website';
  title: string;
  description: string;
  link?: string;
}

export interface SlideData {
  slideNumber: number;
  title: string;
  type: 'architecture' | 'concept' | 'process' | 'graph' | 'comparison' | 'overview';
  imageData: string; // Base64 encoded PNG image
  caption: string;
}

export interface RecommendationData {
  mindmap?: MindmapData;
  flashcards?: FlashcardData[];
  concepts?: ConceptData[];
  exercises?: ExerciseData[];
  resources?: ResourceData[];
  slides?: SlideData[];
}

export interface RecommendationCache {
  noteId: string;
  data: RecommendationData;
  timestamp: number;
}

export type RecommendationType = 'mindmap' | 'flashcards' | 'concepts' | 'exercises' | 'resources' | 'slides';

