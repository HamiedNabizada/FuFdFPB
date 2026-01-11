import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import type { XsdNode } from '../lib/xsd-parser';
import { flattenNodes, getNodeTypeColor } from '../lib/xsd-parser';

interface SchemaSearchProps {
  rootNode: XsdNode | null;
  onSelectNode: (node: XsdNode) => void;
  onHighlightChange: (xpaths: Set<string>) => void;
}

export default function SchemaSearch({ rootNode, onSelectNode, onHighlightChange }: SchemaSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<XsdNode[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootNode || !query.trim()) {
      setResults([]);
      onHighlightChange(new Set());
      return;
    }

    const allNodes = flattenNodes(rootNode);
    const lowerQuery = query.toLowerCase();

    const filtered = allNodes.filter(node => {
      const nameMatch = node.name.toLowerCase().includes(lowerQuery);
      const typeMatch = node.type.toLowerCase().includes(lowerQuery);
      const docMatch = node.documentation?.toLowerCase().includes(lowerQuery);
      return nameMatch || typeMatch || docMatch;
    });

    // Limit results for performance
    const limited = filtered.slice(0, 50);
    setResults(limited);
    setSelectedIndex(0);

    // Send highlighted xpaths to tree
    const highlightedPaths = new Set(limited.map(n => n.xpath));
    onHighlightChange(highlightedPaths);
  }, [query, rootNode, onHighlightChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelectResult(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowResults(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelectResult = (node: XsdNode) => {
    onSelectNode(node);
    setShowResults(false);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    onHighlightChange(new Set());
    inputRef.current?.focus();
  };

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && showResults) {
      const selectedEl = resultsRef.current.children[selectedIndex] as HTMLElement;
      selectedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, showResults]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Element suchen..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowResults(true)}
          onKeyDown={handleKeyDown}
          className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-primary-200 rounded-lg
                     placeholder-primary-400 text-primary-900
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-primary-100 rounded"
          >
            <X className="w-4 h-4 text-primary-400" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {showResults && results.length > 0 && (
        <div
          ref={resultsRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-primary-200
                     rounded-lg shadow-soft max-h-64 overflow-y-auto"
        >
          {results.map((node, index) => (
            <button
              key={node.xpath}
              onClick={() => handleSelectResult(node)}
              className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-primary-50
                         ${index === selectedIndex ? 'bg-primary-50' : ''}`}
            >
              <span className={`text-xs font-mono ${getNodeTypeColor(node.type)}`}>
                {node.type}
              </span>
              <span className="text-sm text-primary-900 truncate">
                {node.name}
              </span>
              {node.documentation && (
                <span className="text-xs text-primary-400 truncate ml-auto max-w-[150px]">
                  {node.documentation}
                </span>
              )}
            </button>
          ))}
          {results.length === 50 && (
            <div className="px-3 py-2 text-xs text-primary-400 text-center border-t border-primary-100">
              Weitere Ergebnisse vorhanden...
            </div>
          )}
        </div>
      )}

      {/* No results message */}
      {showResults && query && results.length === 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-primary-200
                        rounded-lg shadow-soft px-3 py-4 text-center text-sm text-primary-500">
          Keine Elemente gefunden
        </div>
      )}

      {/* Click outside to close */}
      {showResults && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowResults(false)}
        />
      )}
    </div>
  );
}
