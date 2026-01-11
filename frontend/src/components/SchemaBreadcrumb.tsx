import { ChevronRight, Home } from 'lucide-react';
import type { XsdNode } from '../lib/xsd-parser';
import { getNodeTypeColor } from '../lib/xsd-parser';

interface SchemaBreadcrumbProps {
  selectedNode: XsdNode | null;
  onSelectNode: (node: XsdNode) => void;
}

export default function SchemaBreadcrumb({ selectedNode, onSelectNode }: SchemaBreadcrumbProps) {
  if (!selectedNode) {
    return null;
  }

  // Build path from root to selected node
  const buildPath = (node: XsdNode): XsdNode[] => {
    const path: XsdNode[] = [];
    let current: XsdNode | undefined = node;
    while (current) {
      path.unshift(current);
      current = current.parent;
    }
    return path;
  };

  const path = buildPath(selectedNode);

  // Skip if only root element
  if (path.length <= 1) {
    return null;
  }

  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto pb-1">
      {path.map((node, index) => {
        const isLast = index === path.length - 1;
        const isFirst = index === 0;

        return (
          <span key={node.xpath} className="flex items-center gap-1 flex-shrink-0">
            {index > 0 && (
              <ChevronRight className="w-3.5 h-3.5 text-primary-300 flex-shrink-0" />
            )}
            <button
              onClick={() => onSelectNode(node)}
              disabled={isLast}
              className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors
                ${isLast
                  ? 'bg-primary-100 text-primary-800 cursor-default'
                  : 'hover:bg-primary-50 text-primary-600 hover:text-primary-800'
                }`}
            >
              {isFirst && <Home className="w-3 h-3" />}
              <span className={`text-xs font-mono ${getNodeTypeColor(node.type)}`}>
                {node.type}
              </span>
              {node.name && node.name !== node.type && (
                <span className="font-medium truncate max-w-[120px]">
                  {node.name}
                </span>
              )}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
