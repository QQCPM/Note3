/**
 * LessonViewer
 * 
 * Renders lesson content based on lesson type:
 * - lecture: Rich markdown with LaTeX
 * - video: YouTube embed
 * - slides: Image carousel
 * - quiz/practice: Interactive quiz UI
 */

import React, { useState } from 'react';
import { Save, CheckCircle } from 'lucide-react';
import { useCourseStore } from '@/store/courseStore';
import MarkdownRenderer from './MarkdownRenderer';
import VideoLesson from './VideoLesson';
import SlideLesson from './SlideLesson';
import QuizLesson from './QuizLesson';
import SaveToNotesModal from './SaveToNotesModal';

const LessonViewer: React.FC = () => {
  const { getActiveLesson, getActiveCourse, activeLessonId, markLessonComplete } = useCourseStore();
  const [showSaveModal, setShowSaveModal] = useState(false);

  const lesson = getActiveLesson();
  const course = getActiveCourse();

  if (!lesson) {
    return (
      <div className="course-lesson-viewer">
        <div className="course-lesson-content">
          <div className="course-lesson-empty">
            <p>Select a lesson to begin learning</p>
          </div>
        </div>
      </div>
    );
  }

  // Extract markdown content - handle case where it might be raw JSON
  const getMarkdownContent = (content: string | undefined): string => {
    if (!content) return '';
    
    // Check if content looks like JSON (starts with { and contains "markdown":)
    const trimmed = content.trim();
    if (trimmed.startsWith('{') && trimmed.includes('"markdown"')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parsed.markdown || content;
      } catch {
        return content;
      }
    }
    return content;
  };

  // Render content based on lesson type
  const renderLessonContent = () => {
    switch (lesson.type) {
      case 'video':
        return <VideoLesson lesson={lesson} />;

      case 'slides':
        return <SlideLesson lesson={lesson} />;

      case 'quiz':
      case 'practice':
        return <QuizLesson lesson={lesson} />;

      case 'lecture':
      default:
        // Default to markdown rendering
        const markdownContent = getMarkdownContent(lesson.content.markdown);
        return (
          <div className="lecture-lesson">
            {markdownContent ? (
              <MarkdownRenderer content={markdownContent} />
            ) : (
              <p className="lesson-no-content">
                Content is being generated...
              </p>
            )}

            {/* Practice problems at the end of lecture */}
            {lesson.content.practiceProblems && lesson.content.practiceProblems.length > 0 && (
              <div className="lecture-practice-section">
                <h3>📝 Quick Check</h3>
                <QuizLesson lesson={lesson} hideIntroMarkdown />
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="course-lesson-viewer">
      <div className="course-lesson-content">
        {/* Header */}
        <div className="course-lesson-header">
          <div className="course-lesson-header-left">
            <h2>{lesson.title}</h2>
            {lesson.duration && (
              <span className="course-lesson-duration">{lesson.duration}</span>
            )}
          </div>
          <button className="course-lesson-save-btn" onClick={() => setShowSaveModal(true)}>
            <Save size={16} />
            Save to Notes
          </button>
        </div>

        {/* Lesson Type Badge */}
        <div className="course-lesson-type-badge">
          <span className={`lesson-type ${lesson.type}`}>
            {lesson.type.charAt(0).toUpperCase() + lesson.type.slice(1)}
          </span>
        </div>

        {/* Main Content */}
        <div className="course-lesson-body">
          {renderLessonContent()}
        </div>

        {/* Mark Complete Button */}
        <div className="course-lesson-footer">
          <button
            className="course-lesson-complete-btn"
            onClick={() => {
              if (activeLessonId) {
                markLessonComplete(activeLessonId);
              }
            }}
          >
            <CheckCircle size={18} />
            Mark as Complete
          </button>
        </div>
      </div>

      {/* Save to Notes Modal */}
      <SaveToNotesModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        lessonTitle={lesson.title}
        lessonContent={lesson.content.markdown || ''}
        courseTitle={course?.title || 'Course'}
        practiceProblems={lesson.content.practiceProblems}
      />
    </div>
  );
};

export default LessonViewer;
