import React from 'react';
import { Plus } from 'lucide-react';
import { useCourseStore } from '@/store/courseStore';
import { Course } from '@/types/course';

const CourseLibrary: React.FC = () => {
  const { courses, setActiveCourse, setViewMode } = useCourseStore();

  const handleCreateNew = () => {
    setViewMode('home');
  };

  const handleSelectCourse = (course: Course) => {
    setActiveCourse(course.id);
    setViewMode('learning');
  };

  const getStatusClass = (progress: number): string => {
    if (progress === 100) return 'completed';
    if (progress > 0) return 'in-progress';
    return 'not-started';
  };

  const getStatusText = (progress: number): string => {
    if (progress === 100) return 'Completed';
    if (progress > 0) return 'In Progress';
    return 'Not Started';
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours} hours ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getTotalLessons = (course: Course): number => {
    return course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
  };

  const getCompletedLessons = (course: Course): number => {
    return course.modules.reduce(
      (acc, m) => acc + m.lessons.filter((l) => l.completedAt !== undefined).length,
      0
    );
  };

  // Progress ring calculations
  const radius = 16;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="course-library">
      <div className="course-library-header">
        <h1 className="course-library-title">Your Courses</h1>
        <button className="course-library-new-btn" onClick={handleCreateNew}>
          <Plus size={14} />
          New Course
        </button>
      </div>

      <div className="course-library-grid">
        {/* Existing courses */}
        {courses.map((course) => (
          <div
            key={course.id}
            className="course-card"
            onClick={() => handleSelectCourse(course)}
          >
            <div className="course-card-header">
              {/* Progress Ring */}
              <div className="course-card-progress-ring">
                <svg width="40" height="40">
                  <circle
                    className="course-card-progress-ring-bg"
                    cx="20"
                    cy="20"
                    r={radius}
                  />
                  <circle
                    className="course-card-progress-ring-fill"
                    cx="20"
                    cy="20"
                    r={radius}
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - (course.progress / 100) * circumference}
                  />
                </svg>
                <span className="course-card-progress-ring-text">
                  {course.progress}%
                </span>
              </div>
              <span className={`course-card-status ${getStatusClass(course.progress)}`}>
                {getStatusText(course.progress)}
              </span>
            </div>

            <h3 className="course-card-title">{course.title}</h3>
            <p className="course-card-meta">{course.difficulty} • {course.modules.length} modules</p>

            <div className="course-card-footer">
              <span className="course-card-modules">
                {getCompletedLessons(course)} of {getTotalLessons(course)} lessons
              </span>
              <span className="course-card-date">
                {formatDate(new Date(course.updatedAt))}
              </span>
            </div>
          </div>
        ))}

        {/* Create new card */}
        <div className="course-card-new" onClick={handleCreateNew}>
          <div className="course-card-new-icon">
            <Plus size={18} />
          </div>
          <span className="course-card-new-text">Create New Course</span>
        </div>
      </div>
    </div>
  );
};

export default CourseLibrary;
