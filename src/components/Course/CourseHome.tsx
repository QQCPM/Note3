import React, { useState, useRef } from 'react';
import { FileText, Link2, Upload, X, Plus, Sparkles, ArrowLeft } from 'lucide-react';
import { useCourseStore } from '@/store/courseStore';

interface SourceItem {
  id: string;
  type: 'file' | 'link';
  name: string;
  url?: string;
}

const CourseHome: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [duration, setDuration] = useState('2');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { startGeneration, setViewMode } = useCourseStore();

  const handleStartGeneration = () => {
    if (!topic.trim()) return;
    startGeneration({ 
      topic: topic.trim(),
      difficulty,
      estimatedWeeks: parseInt(duration),
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleStartGeneration();
    }
  };

  const handleAddLink = () => {
    if (!linkInput.trim()) return;
    const newSource: SourceItem = {
      id: `link-${Date.now()}`,
      type: 'link',
      name: linkInput.trim(),
      url: linkInput.trim(),
    };
    setSources([...sources, newSource]);
    setLinkInput('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const newSources: SourceItem[] = Array.from(files).map((file) => ({
      id: `file-${Date.now()}-${file.name}`,
      type: 'file',
      name: file.name,
    }));
    setSources([...sources, ...newSources]);
  };

  const handleRemoveSource = (id: string) => {
    setSources(sources.filter((s) => s.id !== id));
  };

  return (
    <div className="course-create">
      {/* Header with back button */}
      <div className="course-create-header">
        <button 
          className="course-create-back" 
          onClick={() => setViewMode('library')}
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="course-create-title">Create New Course</h1>
      </div>

      {/* Topic Input */}
      <div className="course-topic-section">
        <label className="course-section-label">Topic</label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="What do you want to learn? e.g., Model Context Protocol, React Hooks..."
          className="course-topic-input"
        />
      </div>

      {/* Sources Section */}
      <div className="course-sources-section">
        <label className="course-section-label">Learning Sources (Optional)</label>
        <div className="course-sources-grid">
          {/* Files Upload */}
          <div className="course-source-card">
            <div className="course-source-header">
              <FileText className="course-source-icon" />
              <span className="course-source-title">Documents</span>
            </div>
            <div 
              className="course-source-dropzone"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={18} style={{ color: '#7d8590' }} />
              <span className="course-source-dropzone-text">Drop PDFs or click to upload</span>
              <span className="course-source-dropzone-hint">PDF, DOCX, TXT</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          {/* Links Input */}
          <div className="course-source-card">
            <div className="course-source-header">
              <Link2 className="course-source-icon" />
              <span className="course-source-title">Web Resources</span>
            </div>
            <div className="course-link-input-group">
              <input
                type="text"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddLink()}
                placeholder="Paste URL..."
                className="course-link-input"
              />
              <button className="course-link-add-btn" onClick={handleAddLink}>
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Added Sources */}
        {sources.length > 0 && (
          <div className="course-sources-list">
            {sources.map((source) => (
              <div key={source.id} className="course-source-tag">
                {source.type === 'file' ? <FileText /> : <Link2 />}
                <span>{source.name.length > 30 ? source.name.slice(0, 30) + '...' : source.name}</span>
                <button 
                  className="course-source-tag-remove"
                  onClick={() => handleRemoveSource(source.id)}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings - Inline Pills */}
      <div className="course-settings-section">
        <label className="course-section-label">Settings</label>
        
        <div className="course-setting-row">
          <span className="course-setting-label">Difficulty</span>
          <div className="course-setting-pills">
            {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
              <button
                key={level}
                className={`course-setting-pill ${difficulty === level ? 'active' : ''}`}
                onClick={() => setDifficulty(level)}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="course-setting-row">
          <span className="course-setting-label">Duration</span>
          <div className="course-setting-pills">
            {[
              { value: '1', label: '1 week' },
              { value: '2', label: '2 weeks' },
              { value: '4', label: '4 weeks' },
              { value: '8', label: '8 weeks' },
            ].map((opt) => (
              <button
                key={opt.value}
                className={`course-setting-pill ${duration === opt.value ? 'active' : ''}`}
                onClick={() => setDuration(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <div className="course-generate-section">
        <button
          onClick={handleStartGeneration}
          disabled={!topic.trim()}
          className="course-generate-btn"
        >
          <Sparkles size={16} />
          Generate Course
        </button>
      </div>
    </div>
  );
};

export default CourseHome;
