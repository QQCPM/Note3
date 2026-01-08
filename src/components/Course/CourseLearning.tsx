import React from 'react';
import { useCourseStore } from '@/store/courseStore';
import CourseNotes from './CourseNotes';
import CourseOutline from './CourseOutline';
import LessonViewer from './LessonViewer';

const CourseLearning: React.FC = () => {
  const {
    getActiveCourse,
    showNotesSidebar,
  } = useCourseStore();

  const course = getActiveCourse();

  if (!course) {
    return (
      <div className="course-learning">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <p style={{ color: '#7d8590' }}>No course selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="course-learning">
      {/* Body - Header is now integrated into CourseOutline */}
      <div className="course-learning-body">
        {/* Notes Sidebar */}
        {showNotesSidebar && <CourseNotes />}

        {/* Course Outline */}
        <CourseOutline />

        {/* Lesson Content */}
        <LessonViewer />
      </div>
    </div>
  );
};

export default CourseLearning;
