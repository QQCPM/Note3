import React, { useState, useEffect } from 'react';
import { CheckSquare } from 'lucide-react';
import type { Block, QuizBlockData, QuizProblem } from '@/types';
import { updateBlock } from '@/utils/tauri';

interface QuizBlockProps {
    block: Block;
}

const QuizBlock: React.FC<QuizBlockProps> = ({ block }) => {
    const data = block.data as QuizBlockData;
    const [problems, setProblems] = useState<QuizProblem[]>(data.problems || []);
    const [title] = useState(data.title || 'Quick Check');

    useEffect(() => {
        const newData = block.data as QuizBlockData;
        setProblems(newData.problems || []);
    }, [block.data]);

    const handleSelectAnswer = async (problemId: string, optionIndex: number) => {
        const updatedProblems = problems.map(p => {
            if (p.id === problemId) {
                return { ...p, selectedIndex: optionIndex, revealed: true };
            }
            return p;
        });
        setProblems(updatedProblems);

        // Persist to database
        try {
            await updateBlock(block.id, {
                ...data,
                problems: updatedProblems
            });
        } catch (err) {
            console.error('Failed to update quiz block:', err);
        }
    };

    return (
        <div className="quiz-block">
            <div className="quiz-block-header">
                <CheckSquare size={16} />
                <span>{title}</span>
            </div>

            {problems.map((problem) => (
                <div key={problem.id} className="quiz-problem">
                    <p className="quiz-question">{problem.question}</p>

                    <div className="quiz-options">
                        {problem.options.map((option, idx) => {
                            let className = 'quiz-option';

                            if (problem.revealed) {
                                if (idx === problem.correctIndex) {
                                    className += ' correct';
                                } else if (idx === problem.selectedIndex && idx !== problem.correctIndex) {
                                    className += ' incorrect';
                                }
                            }

                            return (
                                <button
                                    key={idx}
                                    className={className}
                                    onClick={() => handleSelectAnswer(problem.id, idx)}
                                    disabled={problem.revealed}
                                >
                                    {option}
                                </button>
                            );
                        })}
                    </div>

                    {problem.revealed && problem.explanation && (
                        <p className="quiz-explanation">{problem.explanation}</p>
                    )}
                </div>
            ))}
        </div>
    );
};

export default QuizBlock;
