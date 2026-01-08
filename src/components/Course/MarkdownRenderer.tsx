/**
 * MarkdownRenderer
 * 
 * Renders markdown content with support for:
 * - GitHub Flavored Markdown (tables, strikethrough, etc.)
 * - LaTeX math equations ($inline$ and $$block$$)
 * - Mermaid diagrams
 * - Syntax-highlighted code blocks
 * - Custom styling for the course theme
 */

import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import mermaid from 'mermaid';
import 'katex/dist/katex.min.css';

// Initialize mermaid with dark theme to match app
mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
        primaryColor: '#6366f1',
        primaryTextColor: '#fff',
        primaryBorderColor: '#4f46e5',
        lineColor: '#6366f1',
        secondaryColor: '#1e1b4b',
        tertiaryColor: '#312e81',
        background: '#0f0f23',
        mainBkg: '#1e1b4b',
        nodeBorder: '#4f46e5',
        clusterBkg: '#1e1b4b',
        clusterBorder: '#4f46e5',
        titleColor: '#fff',
        edgeLabelBackground: '#1e1b4b',
    },
    fontFamily: 'ui-monospace, monospace',
});

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

/**
 * Mermaid diagram component that renders diagrams client-side
 */
const MermaidDiagram: React.FC<{ code: string }> = ({ code }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const idRef = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}`);

    useEffect(() => {
        if (!containerRef.current) return;

        const renderDiagram = async () => {
            try {
                const { svg } = await mermaid.render(idRef.current, code);
                if (containerRef.current) {
                    containerRef.current.innerHTML = svg;
                }
            } catch (error) {
                console.warn('[MermaidDiagram] Render failed:', error);
                if (containerRef.current) {
                    containerRef.current.innerHTML = `<pre class="mermaid-error">${code}</pre>`;
                }
            }
        };

        renderDiagram();
    }, [code]);

    return (
        <div
            ref={containerRef}
            className="mermaid-container"
            style={{
                margin: '1rem 0',
                padding: '1rem',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderRadius: '8px',
                overflow: 'auto'
            }}
        />
    );
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
    if (!content) {
        return null;
    }

    return (
        <div className={`markdown-content ${className || ''}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    // Custom heading styling
                    h1: ({ children }) => (
                        <h1 className="markdown-h1">{children}</h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="markdown-h2">{children}</h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="markdown-h3">{children}</h3>
                    ),

                    // Paragraphs
                    p: ({ children }) => (
                        <p className="markdown-p">{children}</p>
                    ),

                    // Lists
                    ul: ({ children }) => (
                        <ul className="markdown-ul">{children}</ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="markdown-ol">{children}</ol>
                    ),
                    li: ({ children }) => (
                        <li className="markdown-li">{children}</li>
                    ),

                    // Code - with Mermaid support
                    code: ({ className: codeClassName, children, ...props }) => {
                        const match = /language-(\w+)/.exec(codeClassName || '');
                        const language = match?.[1];
                        const codeString = String(children).replace(/\n$/, '');

                        // Handle mermaid diagrams
                        if (language === 'mermaid') {
                            return <MermaidDiagram code={codeString} />;
                        }

                        const isInline = !codeClassName;
                        if (isInline) {
                            return <code className="markdown-code-inline">{children}</code>;
                        }
                        return (
                            <code className={`markdown-code-block ${codeClassName || ''}`} {...props}>
                                {children}
                            </code>
                        );
                    },
                    pre: ({ children }) => (
                        <pre className="markdown-pre">{children}</pre>
                    ),

                    // Blockquote
                    blockquote: ({ children }) => (
                        <blockquote className="markdown-blockquote">{children}</blockquote>
                    ),

                    // Table
                    table: ({ children }) => (
                        <table className="markdown-table">{children}</table>
                    ),
                    thead: ({ children }) => (
                        <thead className="markdown-thead">{children}</thead>
                    ),
                    tbody: ({ children }) => (
                        <tbody className="markdown-tbody">{children}</tbody>
                    ),
                    tr: ({ children }) => (
                        <tr className="markdown-tr">{children}</tr>
                    ),
                    th: ({ children }) => (
                        <th className="markdown-th">{children}</th>
                    ),
                    td: ({ children }) => (
                        <td className="markdown-td">{children}</td>
                    ),

                    // Links
                    a: ({ href, children }) => (
                        <a href={href} className="markdown-link" target="_blank" rel="noopener noreferrer">
                            {children}
                        </a>
                    ),

                    // Strong and emphasis
                    strong: ({ children }) => (
                        <strong className="markdown-strong">{children}</strong>
                    ),
                    em: ({ children }) => (
                        <em className="markdown-em">{children}</em>
                    ),

                    // Horizontal rule
                    hr: () => <hr className="markdown-hr" />,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};

export default MarkdownRenderer;
