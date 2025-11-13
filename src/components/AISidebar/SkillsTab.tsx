import React, { useState } from 'react';

interface Skill {
  id: string;
  name: string;
  icon: string;
  active: boolean;
}

const SkillsTab: React.FC = () => {
  const [skills, setSkills] = useState<Skill[]>([
    { id: '1', name: '📝 Note Writer', icon: '📝', active: true },
    { id: '2', name: '💻 Code Generator', icon: '💻', active: true },
    { id: '3', name: '📊 Data Analyzer', icon: '📊', active: true },
    { id: '4', name: '🎨 UI Designer', icon: '🎨', active: false },
    { id: '5', name: '🔍 Researcher', icon: '🔍', active: false },
    { id: '6', name: '📚 Summarizer', icon: '📚', active: false },
    { id: '7', name: '🌐 Translator', icon: '🌐', active: false },
    { id: '8', name: '🧮 Math Solver', icon: '🧮', active: false },
    { id: '9', name: '✍️ Editor', icon: '✍️', active: false },
  ]);

  const toggleSkill = (id: string) => {
    setSkills(skills.map(skill =>
      skill.id === id ? { ...skill, active: !skill.active } : skill
    ));
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="tab-content-container">
        <div className="section-card">
          <div className="section-header">
            <div>
              <div className="section-title">✨ Available Skills</div>
              <div className="section-subtitle">Specialized AI capabilities</div>
            </div>
            <button
              className="px-3 py-1.5 text-sm bg-accent-blue text-white rounded-sm hover:bg-interactive-hover transition-colors"
              onClick={() => alert('Manage skills')}
            >
              Manage
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', margin: '-4px' }}>
            {skills.map((skill) => (
              <div
                key={skill.id}
                className={`skill-pill ${skill.active ? 'active' : ''}`}
                onClick={() => toggleSkill(skill.id)}
              >
                <div className="skill-pill-checkbox" />
                <span>{skill.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="info-card">
          <div className="info-card-title">About Skills</div>
          <p>
            Skills are specialized instruction sets that enhance the AI's capabilities for specific tasks.
            Activate the skills you need for your current work. Multiple skills can be active simultaneously.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SkillsTab;
