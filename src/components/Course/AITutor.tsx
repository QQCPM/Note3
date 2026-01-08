import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { useCourseStore } from '@/store/courseStore';

const AITutor: React.FC = () => {
  const {
    aiTutorPosition,
    setAITutorPosition,
    toggleAITutor,
    getActiveLesson,
  } = useCourseStore();

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: "Hi! I can help explain any concept from this lesson. What would you like to know more about?",
    },
  ]);

  const containerRef = useRef<HTMLDivElement>(null);
  const lesson = getActiveLesson();

  const handleMouseDown = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setAITutorPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, setAITutorPosition]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage = inputValue.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setInputValue('');

    // Simulate AI response (will be wired to real AI later)
    setTimeout(() => {
      const response = generateMockResponse(userMessage, lesson?.title || 'this topic');
      setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div
      ref={containerRef}
      className="course-ai-tutor"
      style={{
        left: `${aiTutorPosition.x}px`,
        top: `${aiTutorPosition.y}px`,
      }}
    >
      {/* Header */}
      <div className="course-ai-tutor-header" onMouseDown={handleMouseDown}>
        <div className="course-ai-tutor-header-left">
          <MessageSquare />
          <span>AI Assistant</span>
        </div>
        <button className="course-ai-tutor-close" onClick={toggleAITutor}>
          <X />
        </button>
      </div>

      {/* Body */}
      <div className="course-ai-tutor-body">
        {/* Messages */}
        <div className="course-ai-tutor-messages">
          {messages.map((msg, i) => (
            <div key={i} className="course-ai-tutor-message">
              <p>{msg.content}</p>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="course-ai-tutor-input-container">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about this lesson..."
            className="course-ai-tutor-input"
          />
        </div>
      </div>
    </div>
  );
};

function generateMockResponse(_question: string, lessonTitle: string): string {
  const responses = [
    `Great question about ${lessonTitle}! The key thing to understand here is that this concept builds on the fundamentals we covered earlier. Would you like me to break it down further?`,
    `That's an important aspect of ${lessonTitle}. In practice, this means that the system can handle complex scenarios while maintaining simplicity in its interface.`,
    `I can see why you're curious about this. The answer relates to how ${lessonTitle} handles communication between different components. Let me explain...`,
    `This is a common question! The concept you're asking about is central to understanding ${lessonTitle}. The main idea is that it provides a standardized way to interact with external systems.`,
  ];

  return responses[Math.floor(Math.random() * responses.length)];
}

export default AITutor;
