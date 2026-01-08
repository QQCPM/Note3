import React, { Suspense } from 'react';
import { useCourseStore } from '@/store/courseStore';
import CourseLibrary from './CourseLibrary';
import CourseHome from './CourseHome';
import CourseLearning from './CourseLearning';
import './Course.css';

// Lazy load components that depend on LangGraph/LlamaIndex
// This prevents the heavy AI dependencies from loading at app startup
const CourseGeneration = React.lazy(() => import('./CourseGeneration'));
const CourseOutlineEditor = React.lazy(() => import('./CourseOutlineEditor'));

// Loading fallback for lazy components
const LoadingFallback = () => (
  <div className="course-loading">
    <div className="course-loading-spinner" />
    <p>Loading course tools...</p>
  </div>
);

const Course: React.FC = () => {
  const { viewMode } = useCourseStore();

  switch (viewMode) {
    case 'library':
      return <CourseLibrary />;
    case 'home':
      return <CourseHome />;
    case 'generating':
      return (
        <Suspense fallback={<LoadingFallback />}>
          <CourseGeneration />
        </Suspense>
      );
    case 'outline_approval':
      return (
        <Suspense fallback={<LoadingFallback />}>
          <CourseOutlineEditor />
        </Suspense>
      );
    case 'learning':
      return <CourseLearning />;
    default:
      return <CourseLibrary />;
  }
};

export default Course;
