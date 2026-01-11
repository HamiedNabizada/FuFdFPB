import { getNodeTypeLabel } from '../lib/xsd-parser';
import type { XsdNode } from '../lib/xsd-parser';

interface ElementDetailsProps {
  node: XsdNode;
}

export default function ElementDetails({ node }: ElementDetailsProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{node.name || '(unnamed)'}</h2>
        <p className="text-sm text-gray-500">{getNodeTypeLabel(node.type)}</p>
      </div>

      {/* XPath */}
      <div>
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          XPath
        </h3>
        <code className="text-xs bg-gray-100 px-2 py-1 rounded block overflow-x-auto">
          {node.xpath}
        </code>
      </div>

      {/* Documentation */}
      {node.documentation && (
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Dokumentation
          </h3>
          <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded border border-blue-100">
            {node.documentation}
          </p>
        </div>
      )}

      {/* Attributes */}
      {Object.keys(node.attributes).length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Attribute
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(node.attributes).map(([key, value]) => (
                <tr key={key} className="border-b border-gray-100">
                  <td className="py-1 pr-4 font-mono text-blue-600">{key}</td>
                  <td className="py-1 text-gray-700">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Children Summary */}
      {node.children.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Kindelemente ({node.children.length})
          </h3>
          <div className="flex flex-wrap gap-1">
            {node.children.slice(0, 10).map((child) => (
              <span
                key={child.id}
                className="text-xs bg-gray-100 px-2 py-0.5 rounded"
              >
                {child.name || child.type}
              </span>
            ))}
            {node.children.length > 10 && (
              <span className="text-xs text-gray-500">
                +{node.children.length - 10} weitere
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
