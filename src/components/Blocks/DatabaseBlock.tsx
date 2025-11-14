import React from 'react';
import type { Block } from '@/types';

interface DatabaseBlockProps {
  block: Block;
}

const DatabaseBlock: React.FC<DatabaseBlockProps> = ({ block: _block }) => {
  const switchDatabaseView = (databaseId: string, viewType: string) => {
    const database = document.getElementById(databaseId);
    if (!database) return;

    const views = database.querySelectorAll('.database-view');
    views.forEach(view => view.classList.remove('active'));

    const selectedView = database.querySelector(`[data-view="${viewType}"]`);
    if (selectedView) {
      selectedView.classList.add('active');
    }
  };

  return (
    <div className="canvas-block database-block" id="assignmentDatabase">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-white">CS 101 Assignments</div>
        <div className="flex items-center gap-2">
          <select
            className="px-2 py-1 bg-[#0d1117] border border-[#30363d] rounded text-xs text-white"
            onChange={(e) => switchDatabaseView('assignmentDatabase', e.target.value)}
          >
            <option value="table">Table</option>
            <option value="gallery">Gallery</option>
            <option value="calendar">Calendar</option>
          </select>
          <button className="text-xs text-gray-500 hover:text-white">•••</button>
        </div>
      </div>

      {/* Table View */}
      <div className="database-view active" data-view="table">
        <table className="database-table">
          <thead>
            <tr>
              <th>Assignment</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><input type="text" value="Neural Network Implementation" /></td>
              <td><input type="text" value="Oct 22, 2024" /></td>
              <td><span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded">In Progress</span></td>
              <td><input type="text" value="-" /></td>
            </tr>
            <tr>
              <td><input type="text" value="Backpropagation Study" /></td>
              <td><input type="text" value="Oct 15, 2024" /></td>
              <td><span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Complete</span></td>
              <td><input type="text" value="95/100" /></td>
            </tr>
            <tr>
              <td><input type="text" value="Midterm Exam" /></td>
              <td><input type="text" value="Oct 30, 2024" /></td>
              <td><span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">Upcoming</span></td>
              <td><input type="text" value="-" /></td>
            </tr>
          </tbody>
        </table>
        <button className="mt-2 text-xs text-gray-500 hover:text-white">+ Add row</button>
      </div>

      {/* Gallery View */}
      <div className="database-view" data-view="gallery">
        <div className="gallery-grid">
          <div className="gallery-card">
            <div className="gallery-card-title">Neural Network Implementation</div>
            <div className="gallery-card-meta">
              <div>📅 Due: Oct 22, 2024</div>
              <div><span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded">In Progress</span></div>
              <div>📊 Grade: -</div>
            </div>
          </div>
          <div className="gallery-card">
            <div className="gallery-card-title">Backpropagation Study</div>
            <div className="gallery-card-meta">
              <div>📅 Due: Oct 15, 2024</div>
              <div><span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Complete</span></div>
              <div>📊 Grade: 95/100</div>
            </div>
          </div>
          <div className="gallery-card">
            <div className="gallery-card-title">Midterm Exam</div>
            <div className="gallery-card-meta">
              <div>📅 Due: Oct 30, 2024</div>
              <div><span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">Upcoming</span></div>
              <div>📊 Grade: -</div>
            </div>
          </div>
        </div>
        <button className="mt-4 text-xs text-gray-500 hover:text-white">+ Add card</button>
      </div>

      {/* Calendar View */}
      <div className="database-view" data-view="calendar">
        <div className="text-xs text-gray-400 mb-2">October 2024</div>
        <div className="calendar-grid">
          <div className="calendar-header">Sun</div>
          <div className="calendar-header">Mon</div>
          <div className="calendar-header">Tue</div>
          <div className="calendar-header">Wed</div>
          <div className="calendar-header">Thu</div>
          <div className="calendar-header">Fri</div>
          <div className="calendar-header">Sat</div>

          <div className="calendar-day"></div>
          <div className="calendar-day"></div>
          <div className="calendar-day"><div className="calendar-day-number">1</div></div>
          <div className="calendar-day"><div className="calendar-day-number">2</div></div>
          <div className="calendar-day"><div className="calendar-day-number">3</div></div>
          <div className="calendar-day"><div className="calendar-day-number">4</div></div>
          <div className="calendar-day"><div className="calendar-day-number">5</div></div>

          <div className="calendar-day"><div className="calendar-day-number">6</div></div>
          <div className="calendar-day"><div className="calendar-day-number">7</div></div>
          <div className="calendar-day"><div className="calendar-day-number">8</div></div>
          <div className="calendar-day"><div className="calendar-day-number">9</div></div>
          <div className="calendar-day"><div className="calendar-day-number">10</div></div>
          <div className="calendar-day"><div className="calendar-day-number">11</div></div>
          <div className="calendar-day"><div className="calendar-day-number">12</div></div>

          <div className="calendar-day"><div className="calendar-day-number">13</div></div>
          <div className="calendar-day"><div className="calendar-day-number">14</div></div>
          <div className="calendar-day">
            <div className="calendar-day-number">15</div>
            <div className="calendar-event">Backprop Study</div>
          </div>
          <div className="calendar-day"><div className="calendar-day-number">16</div></div>
          <div className="calendar-day"><div className="calendar-day-number">17</div></div>
          <div className="calendar-day"><div className="calendar-day-number">18</div></div>
          <div className="calendar-day"><div className="calendar-day-number">19</div></div>

          <div className="calendar-day"><div className="calendar-day-number">20</div></div>
          <div className="calendar-day"><div className="calendar-day-number">21</div></div>
          <div className="calendar-day">
            <div className="calendar-day-number">22</div>
            <div className="calendar-event">NN Implementation</div>
          </div>
          <div className="calendar-day"><div className="calendar-day-number">23</div></div>
          <div className="calendar-day"><div className="calendar-day-number">24</div></div>
          <div className="calendar-day"><div className="calendar-day-number">25</div></div>
          <div className="calendar-day"><div className="calendar-day-number">26</div></div>

          <div className="calendar-day"><div className="calendar-day-number">27</div></div>
          <div className="calendar-day"><div className="calendar-day-number">28</div></div>
          <div className="calendar-day"><div className="calendar-day-number">29</div></div>
          <div className="calendar-day">
            <div className="calendar-day-number">30</div>
            <div className="calendar-event">Midterm Exam</div>
          </div>
          <div className="calendar-day"><div className="calendar-day-number">31</div></div>
          <div className="calendar-day"></div>
          <div className="calendar-day"></div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseBlock;
