import React from 'react';

interface RecommendationCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    action?: string;
    onClick?: () => void;
    className?: string;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({
    icon,
    title,
    description,
    action,
    onClick,
    className = '',
}) => {
    return (
        <div
            onClick={onClick}
            className={`group flex flex-col p-4 rounded-xl bg-transparent transition-all duration-200 cursor-pointer h-full ${className}`}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="text-[#7d8590] group-hover:text-[#58a6ff] transition-colors text-xl">
                    {icon}
                </div>
            </div>

            <h3 className="text-[#e6edf3] font-semibold text-sm mb-2 group-hover:text-[#58a6ff] transition-colors">
                {title}
            </h3>

            <p className="text-[#7d8590] text-xs leading-relaxed mb-4 flex-1">
                {description}
            </p>

            {action && (
                <div className="text-[#2f81f7] text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    {action}
                    <span>→</span>
                </div>
            )}
        </div>
    );
};

export default RecommendationCard;
