import { useState } from 'react';
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

  // Basic syntax highlighting for XML/XSD
  const highlightXml = (code: string) => {
    return code
      // Comments
      .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="text-primary-400 italic">$1</span>')
      // Tags
      .replace(/(&lt;\/?)([\w:]+)/g, '$1<span class="text-primary-700 font-medium">$2</span>')
      // Attribute names
      .replace(/([\w:]+)=/g, '<span class="text-accent-600">$1</span>=')
      // Attribute values
      .replace(/="([^"]*)"/g, '="<span class="text-orange-600">$1</span>"');
  };

  // Escape HTML and apply highlighting
  const escapedContent = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const highlightedContent = highlightXml(escapedContent);

  return (
    <div className="h-full flex flex-col bg-white rounded-lg border border-primary-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-primary-50 border-b border-primary-200">
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

      {/* Code */}
      <div className="flex-1 overflow-auto">
        <pre className="p-4 text-xs font-mono leading-relaxed">
          <code dangerouslySetInnerHTML={{ __html: highlightedContent }} />
        </pre>
      </div>
    </div>
  );
}
