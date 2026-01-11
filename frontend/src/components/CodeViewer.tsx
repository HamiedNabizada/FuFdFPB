import { useState, useMemo } from 'react';
import { Copy, Check } from 'lucide-react';

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

  // Split content into lines for line numbers
  const lines = useMemo(() => content.split('\n'), [content]);

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
            {lines.map((line, index) => (
              <tr key={index} className="hover:bg-primary-50">
                <td className="px-3 py-0.5 text-right text-primary-300 select-none border-r border-primary-100 w-12">
                  {index + 1}
                </td>
                <td className="px-3 py-0.5 whitespace-pre text-primary-800">
                  {line || ' '}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
