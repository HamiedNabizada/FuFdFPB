import { useState, useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
import hljs from 'highlight.js/lib/core';
import xml from 'highlight.js/lib/languages/xml';
import 'highlight.js/styles/github.css';

// Register XML language (includes XSD support)
hljs.registerLanguage('xml', xml);

interface CodeViewerProps {
  content: string;
  filename?: string;
}

export default function CodeViewer({ content, filename }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Highlight code
  const highlightedLines = useMemo(() => {
    const result = hljs.highlight(content, { language: 'xml' });
    // Split into lines while preserving HTML
    return result.value.split('\n');
  }, [content]);

  return (
    <div className="h-full flex flex-col bg-white rounded-lg border border-primary-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-primary-50 border-b border-primary-200 flex-shrink-0">
        <span className="text-sm font-medium text-primary-700">
          {filename || 'XSD Source'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-primary-600 hover:bg-primary-100 rounded transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-accent-600" />
              Kopiert
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Kopieren
            </>
          )}
        </button>
      </div>

      {/* Code with line numbers */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs font-mono">
          <tbody>
            {highlightedLines.map((line, index) => (
              <tr key={index} className="hover:bg-primary-50">
                <td className="px-3 py-0.5 text-right text-primary-300 select-none border-r border-primary-100 w-12 align-top">
                  {index + 1}
                </td>
                <td
                  className="px-3 py-0.5 whitespace-pre text-primary-800"
                  dangerouslySetInnerHTML={{ __html: line || ' ' }}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
