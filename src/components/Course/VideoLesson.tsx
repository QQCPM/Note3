/**
 * VideoLesson
 * 
 * Renders a lesson with embedded YouTube video.
 * Falls back to lesson content if no video is available.
 */

import React, { useState } from 'react';
import { Play, ExternalLink, Video } from 'lucide-react';
import type { Lesson } from '@/types/course';
import MarkdownRenderer from './MarkdownRenderer';

interface VideoLessonProps {
    lesson: Lesson;
}

const VideoLesson: React.FC<VideoLessonProps> = ({ lesson }) => {
    const [isPlaying, setIsPlaying] = useState(false);

    // Get video URL from lesson content
    const videoUrl = lesson.content.videoUrl;
    const videoId = videoUrl ? extractYouTubeId(videoUrl) : null;

    // If no video, show the markdown content with a placeholder
    if (!videoId) {
        return (
            <div className="video-lesson">
                <div className="video-lesson-placeholder">
                    <Video size={48} />
                    <p>Video content will be generated here</p>
                    <span>YouTube integration requires API key</span>
                </div>

                {/* Show markdown content as fallback */}
                {lesson.content.markdown && (
                    <div className="video-lesson-content">
                        <MarkdownRenderer content={lesson.content.markdown} />
                    </div>
                )}
            </div>
        );
    }

    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;

    return (
        <div className="video-lesson">
            {/* Video Player */}
            <div className="video-lesson-player">
                {!isPlaying ? (
                    <div className="video-lesson-thumbnail" onClick={() => setIsPlaying(true)}>
                        <img src={thumbnailUrl} alt={lesson.title} />
                        <button className="video-lesson-play-btn">
                            <Play size={32} />
                        </button>
                    </div>
                ) : (
                    <iframe
                        src={embedUrl}
                        title={lesson.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                )}
            </div>

            {/* Video Info */}
            <div className="video-lesson-info">
                <a
                    href={`https://www.youtube.com/watch?v=${videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="video-lesson-external"
                >
                    <ExternalLink size={14} />
                    Open in YouTube
                </a>
            </div>

            {/* Additional Content */}
            {lesson.content.markdown && (
                <div className="video-lesson-content">
                    <MarkdownRenderer content={lesson.content.markdown} />
                </div>
            )}
        </div>
    );
};

// Extract YouTube video ID from various URL formats
function extractYouTubeId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

export default VideoLesson;
