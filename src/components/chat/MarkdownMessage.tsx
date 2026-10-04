import type React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Compact styles sized for the chat bubbles (raw HTML is never rendered)
const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  h1: ({ children }) => <h3 className="text-sm font-bold text-white mt-2 mb-1">{children}</h3>,
  h2: ({ children }) => <h3 className="text-sm font-bold text-white mt-2 mb-1">{children}</h3>,
  h3: ({ children }) => <h4 className="text-xs font-bold text-white mt-2 mb-1">{children}</h4>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-indigo-300 underline hover:text-indigo-200">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="px-1 py-0.5 rounded bg-slate-950/70 text-teal-300 font-mono text-[11px]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 p-2 rounded-md bg-slate-950/80 overflow-x-auto text-[11px] [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full text-[11px] border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-slate-700 px-2 py-1 text-left font-semibold bg-slate-900/60">{children}</th>
  ),
  td: ({ children }) => <td className="border border-slate-700 px-2 py-1">{children}</td>,
};

export const MarkdownMessage: React.FC<{ content: string }> = ({ content }) => (
  <div className="break-words">
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  </div>
);
