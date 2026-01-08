import React, { useState, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Copy, Check } from 'lucide-react';
import type { Citation, ThinkingStep } from '@/store/aiStore';
import ActionLog from './ActionLog';
import SourcesPanel from './SourcesPanel';
import CitationTooltip from './CitationTooltip';
import './CleanChatMessage.css';

interface CleanChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isLatest?: boolean;
  messageId?: string;
  thinkingSteps?: ThinkingStep[];
  citations?: Citation[];
}

// Code block with copy button
const CodeBlock: React.FC<{
  className?: string;
  children: React.ReactNode;
}> = ({ className, children }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';

  const handleCopy = useCallback(async () => {
    const text = String(children).replace(/\n$/, '');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  if (!match) {
    // Inline code
    return (
      <code className="bg-[#161b22] px-1.5 py-0.5 rounded text-sm font-mono text-[#e6edf3]">
        {children}
      </code>
    );
  }

  // Block code with copy button
  return (
    <div className="code-block-wrapper relative group my-3">
      {/* Language badge and copy button */}
      <div className="code-block-header flex items-center justify-between px-3 py-1.5 bg-[#0d1117] border-b border-[#30363d] rounded-t-md">
        <span className="text-xs text-[#8b949e] font-mono uppercase tracking-wide">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-[#8b949e] hover:text-[#e6edf3] bg-transparent hover:bg-[#21262d] rounded transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="bg-[#161b22] border border-t-0 border-[#30363d] rounded-b-md p-4 overflow-x-auto">
        <code className={`${className} text-sm font-mono text-[#e6edf3] whitespace-pre`}>
          {children}
        </code>
      </div>
    </div>
  );
};

const CleanChatMessage: React.FC<CleanChatMessageProps> = ({
  role,
  content,
  isLatest = false,
  messageId,
  thinkingSteps,
  citations,
}) => {
  // Process content: normalize LaTeX and handle citations
  const processedContent = useMemo(() => {
    let processed = content;

    // Fix common LaTeX issues from AI output:

    // 1. Fix display math that spans multiple lines without proper delimiters
    // Convert inline $$ that spans lines to proper block format
    processed = processed.replace(/\$\$([^$]+)\$\$/g, (_match, formula) => {
      // If formula contains newlines, ensure it's properly formatted
      const trimmed = formula.trim();
      if (trimmed.includes('\n')) {
        return `\n$$\n${trimmed}\n$$\n`;
      }
      return `$$${trimmed}$$`;
    });

    // 2. Fix cases where $$ is at end of line followed by text
    // e.g., "...formula,$$ where" -> proper separation
    processed = processed.replace(/\$\$\s*\n*where\s/gi, '$$\n\nwhere ');

    // 3. Fix LaTeX that uses [ ] instead of $$ for display math (common AI mistake)
    // Match [ formula ] that looks like LaTeX (contains \frac, \int, etc.)
    processed = processed.replace(/\[\s*(\\[a-zA-Z]+[^[\]]*)\s*\]/g, (_match, formula) => {
      // Only convert if it looks like LaTeX (has backslash commands)
      if (/\\(frac|int|sum|prod|sqrt|left|right|text|cdot|times|div|pm|mp|leq|geq|neq|approx|equiv|alpha|beta|gamma|delta|theta|phi|psi|omega|pi|sigma|mu|nu|lambda|epsilon|rho|tau|chi|eta|zeta|xi|kappa|nabla|partial|infty|forall|exists|in|notin|subset|supset|cup|cap|emptyset|mathbb|mathbf|mathrm|mathcal|vec|hat|bar|dot|ddot|tilde|overline|underline)/.test(formula)) {
        return `$$${formula.trim()}$$`;
      }
      return _match;
    });

    // 4. Fix incomplete display math (starts with $$ but doesn't end properly)
    // Look for $$ followed by content without closing $$
    const dollarParts = processed.split('$$');
    if (dollarParts.length % 2 === 0) {
      // Odd number of $$ means one is unclosed - try to fix
      // This is a heuristic - look for lines that look like LaTeX endings
      processed = processed.replace(/(\$\$[^$]+?)(\n\s*where|\n\s*for|\n\s*with|\n\s*such that)/gi, '$1$$$2');
    }

    // 5. Convert parenthesis-delimited LaTeX to dollar signs
    // AI sometimes outputs (E_n=\hbar\omega) instead of $E_n=\hbar\omega$
    // Match (content) where content contains LaTeX backslash commands
    const latexCommandPattern = /\\(hbar|omega|alpha|beta|gamma|delta|epsilon|theta|phi|psi|sigma|lambda|mu|nu|pi|rho|tau|chi|eta|zeta|xi|kappa|nabla|partial|infty|frac|tfrac|sqrt|sum|int|prod|lim|sin|cos|tan|log|ln|exp|text|mathbf|mathbb|mathrm|mathcal|vec|hat|bar|dot|langle|rangle|left|right|cdot|times|div|pm|mp|leq|geq|neq|approx|equiv|propto|dagger|bra|ket)/;

    // Match parentheses that contain LaTeX-like content
    // Be careful: only match when it looks like LaTeX (has backslash commands OR subscripts/superscripts with backslash context)
    processed = processed.replace(/\(([^()]*\\[a-zA-Z]+[^()]*)\)/g, (match, inner) => {
      // Verify it contains LaTeX commands
      if (latexCommandPattern.test(inner)) {
        return `$${inner.trim()}$`;
      }
      return match;
    });

    // Also handle nested parentheses in LaTeX expressions, e.g., (E_n=\hbar\omega(n+\tfrac12))
    // This catches cases like (\hbar\omega(n+...)) where there's nested ()
    processed = processed.replace(/\(([^()]*\\[a-zA-Z]+[^()]*\([^()]*\)[^()]*)\)/g, (match, inner) => {
      if (latexCommandPattern.test(inner)) {
        return `$${inner.trim()}$`;
      }
      return match;
    });

    // Handle subscript/superscript patterns that look like LaTeX even without backslash prefix
    // e.g., (L^2, L_z) or (E_n^{(1)}) - but only if they also have backslash commands nearby or look very LaTeX-y
    processed = processed.replace(/\(([A-Za-z][_^][{]?[^()]+[}]?[^()]*)\)/g, (match, inner) => {
      // Only convert if it has LaTeX-like patterns (subscripts, superscripts combined with certain chars)
      // Check for common LaTeX patterns: backslash commands, braces for grouping
      if (/\\[a-zA-Z]|[_^]\{|\{[^}]+\}/.test(inner)) {
        return `$${inner.trim()}$`;
      }
      return match;
    });

    return processed;
  }, [content, citations]);

  // Custom component to render citation links
  const renderCitationLink = useCallback((citationId: number) => {
    const citation = citations?.find(c => c.id === citationId);
    if (!citation) {
      return <sup className="text-blue-400">[{citationId}]</sup>;
    }
    return (
      <CitationTooltip citation={citation}>
        <sup className="text-blue-400 cursor-pointer hover:text-blue-300">[{citationId}]</sup>
      </CitationTooltip>
    );
  }, [citations]);

  // Custom text renderer that handles citation markers
  const TextWithCitations: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    if (typeof children !== 'string') {
      return <>{children}</>;
    }

    // Split text by citation markers [1], [2], etc.
    const parts = children.split(/(\[\d+\])/g);

    return (
      <>
        {parts.map((part, index) => {
          const citationMatch = part.match(/\[(\d+)\]/);
          if (citationMatch) {
            const citationId = parseInt(citationMatch[1], 10);
            return <React.Fragment key={index}>{renderCitationLink(citationId)}</React.Fragment>;
          }
          return <React.Fragment key={index}>{part}</React.Fragment>;
        })}
      </>
    );
  };

  return (
    <div
      className={`clean-message ${role} ${isLatest ? 'latest' : ''}`}
      data-message-id={messageId}
    >
      {role === 'user' ? (
        // User question with subtle glow effect
        <div className="user-question">
          <div className="question-glow-line" />
          <p className="question-text">{content}</p>
        </div>
      ) : (
        // AI answer - clean, blended text with LaTeX rendering
        <div className="ai-answer">
          {/* Action log - Antigravity style thinking display */}
          {thinkingSteps && thinkingSteps.length > 0 && (
            <ActionLog logs={thinkingSteps} />
          )}

          {/* Main content */}
          <div className="answer-text markdown-body">
            <ReactMarkdown
              remarkPlugins={[
                remarkGfm,
                [remarkMath, { singleDollarTextMath: true }]
              ]}
              rehypePlugins={[
                [rehypeKatex, {
                  throwOnError: false,
                  errorColor: '#ff6b6b',
                  strict: false,
                  trust: true,
                  output: 'html'
                }]
              ]}
              components={{
                // Paragraph with citation support
                p: ({ children, ...props }) => (
                  <p className="mb-3 last:mb-0 leading-relaxed" {...props}>
                    <TextWithCitations>{children}</TextWithCitations>
                  </p>
                ),
                // Links
                a: ({ href, children, ...props }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                    {...props}
                  >
                    {children}
                  </a>
                ),
                // Code blocks
                code: ({ className, children }: any) => (
                  <CodeBlock className={className}>{children}</CodeBlock>
                ),
                // Pre wrapper (for code blocks)
                pre: ({ children }) => <>{children}</>,
                // Lists
                ul: ({ children, ...props }) => (
                  <ul className="list-disc pl-6 mb-3 space-y-1" {...props}>{children}</ul>
                ),
                ol: ({ children, ...props }) => (
                  <ol className="list-decimal pl-6 mb-3 space-y-1" {...props}>{children}</ol>
                ),
                li: ({ children, ...props }) => (
                  <li className="pl-1" {...props}>
                    <TextWithCitations>{children}</TextWithCitations>
                  </li>
                ),
                // Headings
                h1: ({ children, ...props }) => (
                  <h1 className="text-2xl font-bold mb-3 mt-4 text-[#e6edf3] border-b border-[#30363d] pb-2" {...props}>
                    {children}
                  </h1>
                ),
                h2: ({ children, ...props }) => (
                  <h2 className="text-xl font-semibold mb-2 mt-4 text-[#e6edf3]" {...props}>
                    {children}
                  </h2>
                ),
                h3: ({ children, ...props }) => (
                  <h3 className="text-lg font-semibold mb-2 mt-3 text-[#e6edf3]" {...props}>
                    {children}
                  </h3>
                ),
                h4: ({ children, ...props }) => (
                  <h4 className="text-base font-semibold mb-2 mt-3 text-[#c9d1d9]" {...props}>
                    {children}
                  </h4>
                ),
                // Blockquote
                blockquote: ({ children, ...props }) => (
                  <blockquote className="border-l-4 border-blue-500/50 pl-4 py-1 my-3 bg-blue-500/5 rounded-r italic text-[#8b949e]" {...props}>
                    {children}
                  </blockquote>
                ),
                // Tables (from remark-gfm)
                table: ({ children, ...props }) => (
                  <div className="overflow-x-auto my-3">
                    <table className="min-w-full border border-[#30363d] rounded-lg overflow-hidden" {...props}>
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children, ...props }) => (
                  <thead className="bg-[#161b22]" {...props}>{children}</thead>
                ),
                tbody: ({ children, ...props }) => (
                  <tbody className="divide-y divide-[#30363d]" {...props}>{children}</tbody>
                ),
                tr: ({ children, ...props }) => (
                  <tr className="hover:bg-[#161b22]/50 transition-colors" {...props}>{children}</tr>
                ),
                th: ({ children, ...props }) => (
                  <th className="px-4 py-2 text-left text-sm font-semibold text-[#e6edf3] border-b border-[#30363d]" {...props}>
                    {children}
                  </th>
                ),
                td: ({ children, ...props }) => (
                  <td className="px-4 py-2 text-sm text-[#c9d1d9]" {...props}>{children}</td>
                ),
                // Horizontal rule
                hr: () => <hr className="my-4 border-[#30363d]" />,
                // Strong and emphasis
                strong: ({ children, ...props }) => (
                  <strong className="font-semibold text-[#e6edf3]" {...props}>{children}</strong>
                ),
                em: ({ children, ...props }) => (
                  <em className="italic" {...props}>{children}</em>
                ),
                // Strikethrough (from remark-gfm)
                del: ({ children, ...props }) => (
                  <del className="line-through text-[#8b949e]" {...props}>{children}</del>
                ),
              }}
            >
              {processedContent}
            </ReactMarkdown>
          </div>

          {/* Sources panel */}
          {citations && citations.length > 0 && (
            <SourcesPanel citations={citations} />
          )}
        </div>
      )}
    </div>
  );
};

export default CleanChatMessage;
