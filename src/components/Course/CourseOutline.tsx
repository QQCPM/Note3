import React from 'react';
import { ChevronRight, ChevronDown, BookOpen, Video, FileQuestion, CheckCircle, ArrowLeft } from 'lucide-react';
import { useCourseStore } from '@/store/courseStore';
import type { LessonType } from '@/types/course';

const lessonIcons: Record<LessonType, React.ElementType> = {
  lecture: BookOpen,
  video: Video,
  slides: BookOpen,
  practice: FileQuestion,
  quiz: FileQuestion,
};

const CourseOutline: React.FC = () => {
  const {
    getActiveCourse,
    activeLessonId,
    expandedModules,
    toggleModuleExpanded,
    navigateToLesson,
    setViewMode,
  } = useCourseStore();

  const course = getActiveCourse();

  if (!course) return null;

  return (
    <div className="course-outline-sidebar">
      {/* Course Title Header - Integrated */}
      <div className="course-outline-title">
        <button
          className="course-outline-back"
          onClick={() => setViewMode('library')}
          title="Back to Library"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="course-outline-title-info">
          <h2>{course.title}</h2>
          <div className="course-outline-progress">
            <div className="course-outline-progress-bar">
              <div
                className="course-outline-progress-fill"
                style={{ width: `${course.progress}%` }}
              />
            </div>
            <span>{course.progress}%</span>
          </div>
        </div>
      </div>

      <div className="course-outline-header">
        <h3>Course Outline</h3>

        <div className="course-outline-modules">
          {course.modules.map((module) => {
            const isExpanded = expandedModules.includes(module.id);

            return (
              <div key={module.id} className="course-outline-module">
                <button
                  className="course-outline-module-header"
                  onClick={() => toggleModuleExpanded(module.id)}
                >
                  <span>{module.title}</span>
                  {isExpanded ? <ChevronDown /> : <ChevronRight />}
                </button>

                {isExpanded && (
                  <div className="course-outline-lessons">
                    {module.lessons.map((lesson) => {
                      const Icon = lessonIcons[lesson.type];
                      const isActive = lesson.id === activeLessonId;
                      const isCompleted = lesson.status === 'completed';

                      return (
                        <button
                          key={lesson.id}
                          className={`course-outline-lesson ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                          onClick={() => navigateToLesson(module.id, lesson.id)}
                        >
                          {isCompleted ? <CheckCircle /> : <Icon />}
                          <span className="course-outline-lesson-title">{lesson.title}</span>
                          <span className="course-outline-lesson-duration">
                            {lesson.duration || `${lesson.questionCount}q`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CourseOutline;

