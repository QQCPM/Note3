/**
 * QuizLesson
 * 
 * Interactive quiz component for quiz and practice lesson types.
 * Shows multiple choice questions with immediate feedback.
 */

import React, { useState } from 'react';
import { CheckCircle, XCircle, HelpCircle, Trophy } from 'lucide-react';
import type { Lesson, PracticeProblem } from '@/types/course';
import MarkdownRenderer from './MarkdownRenderer';

interface QuizLessonProps {
    lesson: Lesson;
    hideIntroMarkdown?: boolean; // Skip markdown when embedded in lecture's Quick Check
}

const QuizLesson: React.FC<QuizLessonProps> = ({ lesson, hideIntroMarkdown = false }) => {
    const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
    const [showResults, setShowResults] = useState<Record<string, boolean>>({});
    const [quizComplete, setQuizComplete] = useState(false);

    const problems = lesson.content.practiceProblems || [];

    if (problems.length === 0) {
        return (
            <div className="quiz-lesson">
                <div className="quiz-lesson-empty">
                    <HelpCircle size={48} />
                    <p>Quiz questions will be generated here</p>
                </div>

                {lesson.content.markdown && (
                    <MarkdownRenderer content={lesson.content.markdown} />
                )}
            </div>
        );
    }

    const handleSelectAnswer = (problemId: string, answerIndex: number) => {
        if (showResults[problemId]) return; // Already answered

        setSelectedAnswers(prev => ({ ...prev, [problemId]: answerIndex }));
        setShowResults(prev => ({ ...prev, [problemId]: true }));

        // Check if all questions answered
        const totalAnswered = Object.keys(showResults).length + 1;
        if (totalAnswered === problems.length) {
            setQuizComplete(true);
        }
    };

    const calculateScore = () => {
        let correct = 0;
        problems.forEach((problem, index) => {
            const problemKey = problem.id || `problem-${index}`;
            if (selectedAnswers[problemKey] === problem.correctIndex) {
                correct++;
            }
        });
        return { correct, total: problems.length };
    };

    const resetQuiz = () => {
        setSelectedAnswers({});
        setShowResults({});
        setQuizComplete(false);
    };

    return (
        <div className="quiz-lesson">
            {/* Intro Markdown - skip when embedded in lecture's Quick Check */}
            {!hideIntroMarkdown && lesson.content.markdown && (
                <div className="quiz-lesson-intro">
                    <MarkdownRenderer content={lesson.content.markdown} />
                </div>
            )}

            {/* Quiz Header */}
            <div className="quiz-lesson-header">
                <h3>Quiz: {lesson.title}</h3>
                <span>{problems.length} questions</span>
            </div>

            {/* Questions */}
            <div className="quiz-lesson-questions">
                {problems.map((problem, index) => {
                    // Use problem.id if available, fallback to index-based key
                    const problemKey = problem.id || `problem-${index}`;
                    return (
                        <QuestionCard
                            key={problemKey}
                            problem={{ ...problem, id: problemKey }}
                            questionNumber={index + 1}
                            selectedAnswer={selectedAnswers[problemKey]}
                            showResult={showResults[problemKey] || false}
                            onSelectAnswer={(answerIndex) => handleSelectAnswer(problemKey, answerIndex)}
                        />
                    );
                })}
            </div>

            {/* Score Summary */}
            {quizComplete && (
                <div className="quiz-lesson-summary">
                    <Trophy size={32} />
                    <div className="quiz-lesson-score">
                        <span className="score-value">{calculateScore().correct}/{calculateScore().total}</span>
                        <span className="score-label">Correct</span>
                    </div>
                    <button className="quiz-lesson-retry" onClick={resetQuiz}>
                        Try Again
                    </button>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// QUESTION CARD SUBCOMPONENT
// ============================================================================

interface QuestionCardProps {
    problem: PracticeProblem;
    questionNumber: number;
    selectedAnswer: number | undefined;
    showResult: boolean;
    onSelectAnswer: (index: number) => void;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
    problem,
    questionNumber,
    selectedAnswer,
    showResult,
    onSelectAnswer,
}) => {
    return (
        <div className={`quiz-question-card ${showResult ? 'answered' : ''}`}>
            <div className="quiz-question-header">
                <span className="quiz-question-number">Q{questionNumber}</span>
                <p className="quiz-question-text">{problem.question}</p>
            </div>

            <div className="quiz-question-options">
                {problem.options.map((option, index) => {
                    let optionClass = 'quiz-option';

                    if (showResult) {
                        if (index === problem.correctIndex) {
                            optionClass += ' correct';
                        } else if (index === selectedAnswer && index !== problem.correctIndex) {
                            optionClass += ' incorrect';
                        }
                    } else if (selectedAnswer === index) {
                        optionClass += ' selected';
                    }

                    return (
                        <button
                            key={index}
                            className={optionClass}
                            onClick={() => onSelectAnswer(index)}
                            disabled={showResult}
                        >
                            <span className="quiz-option-letter">
                                {String.fromCharCode(65 + index)}
                            </span>
                            <span className="quiz-option-text">{option}</span>
                            {showResult && index === problem.correctIndex && (
                                <CheckCircle size={18} className="quiz-option-icon" />
                            )}
                            {showResult && index === selectedAnswer && index !== problem.correctIndex && (
                                <XCircle size={18} className="quiz-option-icon" />
                            )}
                        </button>
                    );
                })}
            </div>

            {showResult && problem.explanation && (
                <div className="quiz-question-explanation">
                    <strong>Explanation:</strong> {problem.explanation}
                </div>
            )}
        </div>
    );
};

export default QuizLesson;
