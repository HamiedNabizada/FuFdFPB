import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, MessageCircle } from 'lucide-react';
import type { XsdNode } from '../lib/xsd-parser';
import { getNodeTypeColor } from '../lib/xsd-parser';

interface SchemaTreeProps {
  node: XsdNode;
  selectedNode: XsdNode | null;
  onSelectNode: (node: XsdNode) => void;
  commentCounts: Record<string, number>;
  highlightedXpaths?: Set<string>;
  level?: number;
}

export default function SchemaTree({
  node,
  selectedNode,
  onSelectNode,
  commentCounts,
  highlightedXpaths,
  level = 0,
}: SchemaTreeProps) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedNode?.xpath === node.xpath;
  const isHighlighted = highlightedXpaths?.has(node.xpath);
  const commentCount = commentCounts[node.xpath] || 0;

  // Check if any descendant is highlighted (to auto-expand)
  const hasHighlightedDescendant = (n: XsdNode): boolean => {
    if (highlightedXpaths?.has(n.xpath)) return true;
    return n.children.some(child => hasHighlightedDescendant(child));
  };

  // Auto-expand when descendants are highlighted
  useEffect(() => {
    if (highlightedXpaths && highlightedXpaths.size > 0 && hasHighlightedDescendant(node)) {
      setExpanded(true);
    }
  }, [highlightedXpaths]);

  // Filter out annotation nodes for cleaner display
  const visibleChildren = node.children.filter(
    child => !['annotation', 'documentation'].includes(child.type)
  );

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectNode(node);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer transition-colors
          ${isSelected ? 'bg-primary-100 hover:bg-primary-100' : 'hover:bg-primary-50'}
          ${isHighlighted && !isSelected ? 'bg-accent-50 ring-1 ring-accent-300' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {/* Expand/Collapse Button */}
        <button
          onClick={handleToggle}
          className={`w-5 h-5 flex items-center justify-center ${
            hasChildren ? 'hover:bg-primary-100 rounded' : ''
          }`}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="w-4 h-4 text-primary-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-primary-400" />
            )
          ) : (
            <span className="w-4" />
          )}
        </button>

        {/* Node Type Badge */}
        <span className={`text-xs font-mono ${getNodeTypeColor(node.type)}`}>
          {node.type}
        </span>

        {/* Node Name */}
        <span className="text-sm font-medium text-primary-800 truncate">
          {node.name || '(unnamed)'}
        </span>

        {/* Comment Count Badge */}
        {commentCount > 0 && (
          <span className="flex items-center gap-0.5 ml-auto text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
            <MessageCircle className="w-3 h-3" />
            {commentCount}
          </span>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {visibleChildren.map((child) => (
            <SchemaTree
              key={child.id}
              node={child}
              selectedNode={selectedNode}
              onSelectNode={onSelectNode}
              commentCounts={commentCounts}
              highlightedXpaths={highlightedXpaths}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
