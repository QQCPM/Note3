// Main Course component - lazy loads CourseGeneration and CourseOutlineEditor internally
export { default as Course } from './Course';

// These components don't depend on LangGraph/LlamaIndex
export { default as CourseLibrary } from './CourseLibrary';
export { default as CourseHome } from './CourseHome';
export { default as CourseLearning } from './CourseLearning';
export { default as CourseNotes } from './CourseNotes';
export { default as CourseOutline } from './CourseOutline';
export { default as LessonViewer } from './LessonViewer';

// NOTE: CourseGeneration and CourseOutlineEditor are NOT exported here
// They are lazy-loaded by Course.tsx using React.lazy() to avoid
// loading LangGraph/LlamaIndex at app startup
