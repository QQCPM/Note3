import React from 'react';
import 'katex/dist/katex.min.css';
import katex from 'katex';

interface RichTextRendererProps {
  content: string;
}

/**
 * Renders text with LaTeX math formulas
 * Supports:
 * - Inline math: $formula$
 * - Block math: $$formula$$
 */
const RichTextRenderer: React.FC<RichTextRendererProps> = ({ content }) => {
  const renderContent = () => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    // Match both $$ and $ patterns
    const mathPattern = /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$)/g;
    let match;

    while ((match = mathPattern.exec(content)) !== null) {
      // Add text before the math
      if (match.index > lastIndex) {
        const text = content.substring(lastIndex, match.index);
        parts.push(<span key={`text-${lastIndex}`}>{text}</span>);
      }

      const mathString = match[0];
      const isBlock = mathString.startsWith('$$');
      const formula = isBlock
        ? mathString.slice(2, -2).trim()
        : mathString.slice(1, -1).trim();

      try {
        const html = katex.renderToString(formula, {
          displayMode: isBlock,
          throwOnError: false,
          output: 'html',
        });

        parts.push(
          <span
            key={`math-${match.index}`}
            className={isBlock ? 'block my-4' : 'inline-block mx-1'}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } catch (error) {
        // If rendering fails, show the original text
        parts.push(
          <span key={`error-${match.index}`} className="text-red-400">
            {mathString}
          </span>
        );
      }

      lastIndex = match.index + mathString.length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(<span key={`text-end`}>{content.substring(lastIndex)}</span>);
    }

    return parts;
  };

  return (
    <div className="rich-text-content whitespace-pre-wrap">
      {renderContent()}
    </div>
  );
};

export default RichTextRenderer;
