import type React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Compact styles sized for the chat bubbles (raw HTML is never rendered)
const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  h1: ({ children }) => <h3 className="mb-1 mt-2 font-display text-sm font-semibold text-u-title">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-1 mt-2 font-display text-sm font-semibold text-u-title">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1 mt-2 font-display text-xs font-semibold text-u-title">{children}</h4>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-4">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-u-title">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-u-interaction underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-u-code-bg px-1 py-0.5 font-mono text-[11px] text-u-code-accent">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-md bg-u-code-bg p-2 text-[11px] [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-u-row-line bg-u-th-bg px-2 py-1 text-left font-semibold text-u-th-text">{children}</th>
  ),
  td: ({ children }) => <td className="border border-u-row-line px-2 py-1">{children}</td>,
};

export const MarkdownMessage: React.FC<{ content: string }> = ({ content }) => (
  <div className="break-words">
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  </div>
);
