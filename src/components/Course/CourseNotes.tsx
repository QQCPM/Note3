import React from 'react';
import { FileText, X } from 'lucide-react';
import { useCourseStore } from '@/store/courseStore';

const CourseNotes: React.FC = () => {
  const {
    activeCourseId,
    courseNotes,
    userNotesInput,
    setUserNotesInput,
    saveCurrentNote,
    toggleNotesSidebar,
  } = useCourseStore();

  const notes = courseNotes.filter((n) => n.courseId === activeCourseId);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="course-notes-sidebar">
      <div className="course-notes-header">
        <h2>
          <FileText />
          My Notes
        </h2>
        <button onClick={toggleNotesSidebar}>
          <X size={20} />
        </button>
      </div>

      <div className="course-notes-content">
        <textarea
          value={userNotesInput}
          onChange={(e) => setUserNotesInput(e.target.value)}
          placeholder="Take notes as you learn..."
          className="course-notes-input"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.metaKey) {
              saveCurrentNote();
            }
          }}
        />

        <div className="course-notes-list">
          {notes.map((note) => (
            <div key={note.id} className="course-note-item">
              <div className="course-note-item-time">{formatTime(note.timestamp)}</div>
              <div className="course-note-item-content">
                {note.content.length > 100
                  ? `${note.content.substring(0, 100)}...`
                  : note.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CourseNotes;
