import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { RootNodeMention } from '@/components/RootNode';

interface RichTextRendererProps {
  content: string;
  enableMarkdown?: boolean; // Allow disabling markdown for plain text blocks
  projectId?: string | null; // For scoping root node lookups
}

/**
 * Detects @mentions in text and returns segments for rendering
 */
function parseTextWithMentions(text: string): Array<{ type: 'text' | 'mention'; content: string }> {
  const segments: Array<{ type: 'text' | 'mention'; content: string }> = [];
  const mentionRegex = /@([\w]+(?:\s+[\w]+){0,2})/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    
    // Add the mention
    segments.push({ type: 'mention', content: match[1] });
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }
  
  return segments;
}

/**
 * Normalizes LaTeX in AI-generated content to ensure proper rendering
 */
function normalizeLatex(content: string): string {
  let processed = content;
  
  // 1. Fix display math that spans multiple lines without proper delimiters
  processed = processed.replace(/\$\$([^$]+)\$\$/g, (_match, formula) => {
    const trimmed = formula.trim();
    if (trimmed.includes('\n')) {
      return `\n$$\n${trimmed}\n$$\n`;
    }
    return `$$${trimmed}$$`;
  });
  
  // 2. Fix cases where $$ is at end of line followed by text
  processed = processed.replace(/\$\$\s*\n*where\s/gi, '$$\n\nwhere ');
  
  // 3. Fix LaTeX that uses [ ] instead of $$ for display math
  processed = processed.replace(/\[\s*(\\[a-zA-Z]+[^[\]]*)\s*\]/g, (match, formula) => {
    if (/\\(frac|int|sum|prod|sqrt|left|right|text|cdot|times|div|pm|mp|leq|geq|neq|approx|equiv|alpha|beta|gamma|delta|theta|phi|psi|omega|pi|sigma|mu|nu|lambda|epsilon|rho|tau|chi|eta|zeta|xi|kappa|nabla|partial|infty|forall|exists|in|notin|subset|supset|cup|cap|emptyset|mathbb|mathbf|mathrm|mathcal|vec|hat|bar|dot|ddot|tilde|overline|underline)/.test(formula)) {
      return `$$${formula.trim()}$$`;
    }
    return match;
  });
  
  return processed;
}

/**
 * Renders text with Markdown and LaTeX math formulas
 * Supports:
 * - Full GitHub-flavored Markdown (bold, italic, headers, lists, tables, code blocks, links)
 * - Inline math: $formula$
 * - Block math: $$formula$$
 */

/**
 * Renders text segments with @mentions converted to RootNodeMention components
 */
const TextWithMentions: React.FC<{ text: string; projectId?: string | null }> = ({ text, projectId }) => {
  const segments = useMemo(() => parseTextWithMentions(text), [text]);
  
  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'mention') {
          return (
            <RootNodeMention
              key={`mention-${index}`}
              term={segment.content}
              projectId={projectId}
            />
          );
        }
        return <span key={`text-${index}`}>{segment.content}</span>;
      })}
    </>
  );
};

const RichTextRenderer: React.FC<RichTextRendererProps> = ({
  content,
  enableMarkdown = true,
  projectId
}) => {
  // Normalize LaTeX before rendering
  const processedContent = useMemo(() => normalizeLatex(content), [content]);
  
  // Check if content has @mentions
  const hasMentions = useMemo(() => /@[\w]+/.test(content), [content]);
  
  // If markdown is disabled, render as plain text with mentions
  if (!enableMarkdown) {
    return (
      <div className="rich-text-content whitespace-pre-wrap text-gray-200">
        {hasMentions ? <TextWithMentions text={content} projectId={projectId} /> : content}
      </div>
    );
  }

  return (
    <div className="rich-text-content markdown-content">
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm,
          [remarkMath, { singleDollarTextMath: true }]
        ]}
        rehypePlugins={[
          [rehypeKatex, {
            throwOnError: false,
            errorColor: '#ef4444',
            strict: false,
            trust: true,
            output: 'html'
          }]
        ]}
        components={{
          // Custom styling for markdown elements
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mb-4 text-gray-100">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold mb-3 text-gray-100">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mb-2 text-gray-200">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold mb-2 text-gray-200">{children}</h4>
          ),
          p: ({ children }) => {
            // Process children to detect @mentions in text nodes
            const processChildren = (nodes: React.ReactNode): React.ReactNode => {
              return React.Children.map(nodes, (child, idx) => {
                if (typeof child === 'string' && /@[\w]+/.test(child)) {
                  return <TextWithMentions key={idx} text={child} projectId={projectId} />;
                }
                return child;
              });
            };
            return (
              <p className="mb-3 text-gray-300 leading-relaxed">{processChildren(children)}</p>
            );
          },
          strong: ({ children }) => (
            <strong className="font-bold text-gray-100">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-300">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-3 text-gray-300 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-3 text-gray-300 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="ml-4 text-gray-300">{children}</li>
          ),
          code: ({ className, children, ...props }) => {
            const inline = !(props as any).node?.position;
            return inline ? (
              <code className="bg-gray-800 text-purple-300 px-1.5 py-0.5 rounded text-sm font-mono">
                {children}
              </code>
            ) : (
              <code className={`block bg-gray-900 text-gray-300 p-3 rounded-lg overflow-x-auto text-sm font-mono ${className || ''}`}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-3 overflow-x-auto">{children}</pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-purple-500 pl-4 italic text-gray-400 mb-3">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-purple-400 hover:text-purple-300 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-3">
              <table className="min-w-full border border-gray-700 text-gray-300">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-800">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-gray-700">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="border-b border-gray-700">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left font-semibold text-gray-200">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-gray-300">{children}</td>
          ),
          hr: () => <hr className="my-4 border-gray-700" />,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default RichTextRenderer;
