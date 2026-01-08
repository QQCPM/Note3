/**
 * SlideLesson
 * 
 * Displays lesson slides in a carousel format.
 * Can show pre-generated slides or trigger on-demand generation.
 */

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Presentation } from 'lucide-react';
import type { Lesson } from '@/types/course';
import MarkdownRenderer from './MarkdownRenderer';

interface SlideLessonProps {
    lesson: Lesson;
}

const SlideLesson: React.FC<SlideLessonProps> = ({ lesson }) => {
    const [currentSlide, setCurrentSlide] = useState(0);

    // Check if lesson has pre-generated slides
    const slides = lesson.content.slides || [];
    const hasSlides = slides.length > 0;

    if (!hasSlides) {
        return (
            <div className="slide-lesson">
                <div className="slide-lesson-placeholder">
                    <Presentation size={48} />
                    <p>Slides will be generated here</p>
                    <span>Visual slides are created using AI</span>
                </div>

                {/* Show markdown content as fallback */}
                {lesson.content.markdown && (
                    <div className="slide-lesson-content">
                        <MarkdownRenderer content={lesson.content.markdown} />
                    </div>
                )}
            </div>
        );
    }

    const nextSlide = () => {
        setCurrentSlide(prev => Math.min(prev + 1, slides.length - 1));
    };

    const prevSlide = () => {
        setCurrentSlide(prev => Math.max(prev - 1, 0));
    };

    const goToSlide = (index: number) => {
        setCurrentSlide(index);
    };

    const currentSlideData = slides[currentSlide];

    return (
        <div className="slide-lesson">
            {/* Slide Viewer */}
            <div className="slide-lesson-viewer">
                {/* Navigation Arrows */}
                <button
                    className="slide-nav-btn prev"
                    onClick={prevSlide}
                    disabled={currentSlide === 0}
                >
                    <ChevronLeft size={24} />
                </button>

                {/* Slide Content */}
                <div className="slide-lesson-display">
                    {currentSlideData.imageData ? (
                        <img
                            src={`data:image/png;base64,${currentSlideData.imageData}`}
                            alt={currentSlideData.title || `Slide ${currentSlide + 1}`}
                            className="slide-lesson-image"
                        />
                    ) : (
                        <div className="slide-lesson-text-slide">
                            <h3>{currentSlideData.title}</h3>
                            {currentSlideData.content && (
                                <MarkdownRenderer content={currentSlideData.content} />
                            )}
                        </div>
                    )}
                </div>

                <button
                    className="slide-nav-btn next"
                    onClick={nextSlide}
                    disabled={currentSlide === slides.length - 1}
                >
                    <ChevronRight size={24} />
                </button>
            </div>

            {/* Slide Info */}
            <div className="slide-lesson-info">
                <span className="slide-counter">
                    {currentSlide + 1} / {slides.length}
                </span>
                {currentSlideData.title && (
                    <span className="slide-title">{currentSlideData.title}</span>
                )}
            </div>

            {/* Thumbnail Navigation */}
            <div className="slide-lesson-thumbnails">
                {slides.map((_, index) => (
                    <button
                        key={index}
                        className={`slide-thumbnail ${index === currentSlide ? 'active' : ''}`}
                        onClick={() => goToSlide(index)}
                    >
                        <span>{index + 1}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default SlideLesson;
