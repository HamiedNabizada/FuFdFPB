import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { getNodeTypeLabel } from '../lib/xsd-parser';
import type { XsdNode } from '../lib/xsd-parser';

interface ElementDetailsProps {
  node: XsdNode;
  schemaContent?: string;
}

export default function ElementDetails({ node, schemaContent }: ElementDetailsProps) {
  const [showCode, setShowCode] = useState(true);
  const [copied, setCopied] = useState(false);

  // Extract the XML snippet for this element
  const codeSnippet = useMemo(() => {
    if (!schemaContent) return null;

    // Build search pattern based on element type and name
    const tagName = node.type.includes(':') ? node.type : `xs:${node.type}`;
    const nameAttr = node.attributes['name'] || node.attributes['ref'];

    let searchPattern: string;
    if (nameAttr) {
      // Search for opening tag with name attribute
      searchPattern = `<${tagName}[^>]*name="${nameAttr}"`;
    } else {
      // For elements without name, try to find by type
      searchPattern = `<${tagName}`;
    }

    const regex = new RegExp(searchPattern);
    const match = schemaContent.match(regex);

    if (!match || match.index === undefined) return null;

    const startIndex = match.index;

    // Find the matching closing tag or self-closing
    let depth = 0;
    let endIndex = startIndex;
    let tagStart = -1;

    for (let i = startIndex; i < schemaContent.length; i++) {
      const char = schemaContent[i];

      if (char === '<') {
        tagStart = i;
      } else if (char === '>' && tagStart >= 0) {
        const tag = schemaContent.substring(tagStart, i + 1);

        if (tag.startsWith('</')) {
          depth--;
          if (depth === 0) {
            endIndex = i + 1;
            break;
          }
        } else if (tag.endsWith('/>')) {
          if (depth === 0) {
            endIndex = i + 1;
            break;
          }
        } else if (!tag.startsWith('<?') && !tag.startsWith('<!')) {
          depth++;
        }
      }
    }

    const snippet = schemaContent.substring(startIndex, endIndex);

    // Limit to reasonable size
    if (snippet.length > 2000) {
      return snippet.substring(0, 2000) + '\n... (gekürzt)';
    }

    return snippet;
  }, [schemaContent, node]);

  const handleCopy = async () => {
    if (codeSnippet) {
      await navigator.clipboard.writeText(codeSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-primary-900">{node.name || '(unnamed)'}</h2>
        <p className="text-sm text-primary-500">{getNodeTypeLabel(node.type)}</p>
      </div>

      {/* XPath */}
      <div>
        <h3 className="text-xs font-medium text-primary-500 uppercase tracking-wide mb-1">
          XPath
        </h3>
        <code className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded block overflow-x-auto">
          {node.xpath}
        </code>
      </div>

      {/* Documentation */}
      {node.documentation && (
        <div>
          <h3 className="text-xs font-medium text-primary-500 uppercase tracking-wide mb-1">
            Dokumentation
          </h3>
          <p className="text-sm text-primary-700 bg-accent-50 p-3 rounded border border-accent-100">
            {node.documentation}
          </p>
        </div>
      )}

      {/* Attributes */}
      {Object.keys(node.attributes).length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-primary-500 uppercase tracking-wide mb-2">
            Attribute
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(node.attributes).map(([key, value]) => (
                <tr key={key} className="border-b border-primary-100">
                  <td className="py-1 pr-4 font-mono text-primary-600">{key}</td>
                  <td className="py-1 text-primary-700">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Code Snippet */}
      {codeSnippet && (
        <div>
          <button
            onClick={() => setShowCode(!showCode)}
            className="flex items-center gap-1 text-xs font-medium text-primary-500 uppercase tracking-wide mb-2 hover:text-primary-700"
          >
            {showCode ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            XSD-Code
          </button>
          {showCode && (
            <div className="relative">
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-white rounded text-primary-500 hover:text-primary-700 transition-colors"
                title="Code kopieren"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-accent-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <pre className="text-xs font-mono bg-primary-50 p-3 rounded border border-primary-200 overflow-x-auto max-h-64 overflow-y-auto">
                {codeSnippet}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Children Summary */}
      {node.children.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-primary-500 uppercase tracking-wide mb-2">
            Kindelemente ({node.children.length})
          </h3>
          <div className="flex flex-wrap gap-1">
            {node.children.slice(0, 10).map((child) => (
              <span
                key={child.id}
                className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded"
              >
                {child.name || child.type}
              </span>
            ))}
            {node.children.length > 10 && (
              <span className="text-xs text-primary-400">
                +{node.children.length - 10} weitere
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
