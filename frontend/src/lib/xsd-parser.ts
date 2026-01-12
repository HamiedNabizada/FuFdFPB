import { XMLParser } from 'fast-xml-parser';

export interface XsdNode {
  id: string;
  name: string;
  type: string;          // element, complexType, simpleType, attribute, etc.
  xpath: string;
  attributes: Record<string, string>;
  documentation?: string;
  children: XsdNode[];
  parent?: XsdNode;
  // Ref-Tracking
  isRef?: boolean;           // true wenn Element ein ref= Attribut hat
  refName?: string;          // Name des referenzierten Elements
  refTargetXpath?: string;   // XPath zum Ziel-Element (nach Auflösung)
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  preserveOrder: true,
  commentPropName: '#comment',
});

// Counter für eindeutige IDs
let idCounter = 0;

function generateId(): string {
  return `node_${idCounter++}`;
}

function getNodeName(node: any): string {
  const keys = Object.keys(node).filter(k => !k.startsWith('@_') && !k.startsWith('#') && k !== ':@');
  return keys[0] || 'unknown';
}

function getAttributes(node: any): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (node[':@']) {
    for (const [key, value] of Object.entries(node[':@'])) {
      if (key.startsWith('@_')) {
        attrs[key.substring(2)] = String(value);
      }
    }
  }
  return attrs;
}

function getDocumentation(children: any[]): string | undefined {
  for (const child of children) {
    const name = getNodeName(child);
    if (name === 'xs:annotation' || name === 'xsd:annotation') {
      const annotationChildren = child[name] || [];
      for (const annChild of annotationChildren) {
        const annName = getNodeName(annChild);
        if (annName === 'xs:documentation' || annName === 'xsd:documentation') {
          const docContent = annChild[annName];
          if (Array.isArray(docContent)) {
            for (const item of docContent) {
              if (item['#text']) {
                return String(item['#text']).trim();
              }
            }
          }
        }
      }
    }
  }
  return undefined;
}

function parseNode(node: any, parentXpath: string, parent?: XsdNode): XsdNode | null {
  const nodeName = getNodeName(node);

  // Skip text nodes and comments
  if (nodeName === '#text' || nodeName === '#comment' || nodeName === 'unknown') {
    return null;
  }

  const attributes = getAttributes(node);
  const nameAttr = attributes['name'] || attributes['ref'] || '';

  // Build xpath
  let xpath = parentXpath;
  if (nameAttr) {
    xpath = `${parentXpath}/${nodeName}[@name='${nameAttr}']`;
  } else {
    xpath = `${parentXpath}/${nodeName}`;
  }

  const children: XsdNode[] = [];
  const nodeContent = node[nodeName];

  // Get documentation from children
  const documentation = Array.isArray(nodeContent) ? getDocumentation(nodeContent) : undefined;

  // Prüfen ob es eine Referenz ist
  const isRef = 'ref' in attributes;
  const refName = attributes['ref'];

  const xsdNode: XsdNode = {
    id: generateId(),
    name: nameAttr || nodeName.replace(/^xs:|^xsd:/, ''),
    type: nodeName.replace(/^xs:|^xsd:/, ''),
    xpath,
    attributes,
    documentation,
    children,
    parent,
    isRef,
    refName: isRef ? refName : undefined,
  };

  // Parse children
  if (Array.isArray(nodeContent)) {
    for (const childNode of nodeContent) {
      const childXsdNode = parseNode(childNode, xpath, xsdNode);
      if (childXsdNode) {
        children.push(childXsdNode);
      }
    }
  }

  return xsdNode;
}

// Index aller benannten Elemente aufbauen
function buildNameIndex(node: XsdNode, index: Map<string, XsdNode> = new Map()): Map<string, XsdNode> {
  // Nur Elemente mit name-Attribut (nicht ref) indizieren
  if (node.attributes['name'] && !node.isRef) {
    const name = node.attributes['name'];
    // Schlüssel: typ:name (z.B. "element:PersonName" oder "complexType:AddressType")
    const key = `${node.type}:${name}`;
    index.set(key, node);
    // Auch ohne Typ-Prefix für einfachere Suche
    if (!index.has(name)) {
      index.set(name, node);
    }
  }

  for (const child of node.children) {
    buildNameIndex(child, index);
  }

  return index;
}

// Refs zu ihren Zielen auflösen
function resolveRefs(node: XsdNode, nameIndex: Map<string, XsdNode>): void {
  if (node.isRef && node.refName) {
    // Namespace-Prefix entfernen falls vorhanden (z.B. "tns:PersonName" -> "PersonName")
    const refNameClean = node.refName.includes(':')
      ? node.refName.split(':')[1]
      : node.refName;

    // Zuerst mit passendem Typ suchen
    const typeKey = `${node.type}:${refNameClean}`;
    let target = nameIndex.get(typeKey);

    // Falls nicht gefunden, ohne Typ-Prefix suchen
    if (!target) {
      target = nameIndex.get(refNameClean);
    }

    if (target) {
      node.refTargetXpath = target.xpath;
    }
  }

  for (const child of node.children) {
    resolveRefs(child, nameIndex);
  }
}

export function parseXsd(xsdContent: string): XsdNode | null {
  try {
    // Reset ID counter
    idCounter = 0;

    const parsed = parser.parse(xsdContent);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }

    // Find the schema element
    for (const node of parsed) {
      const nodeName = getNodeName(node);
      if (nodeName === 'xs:schema' || nodeName === 'xsd:schema') {
        const root = parseNode(node, '', undefined);

        if (root) {
          // Index aufbauen und Refs auflösen
          const nameIndex = buildNameIndex(root);
          resolveRefs(root, nameIndex);
        }

        return root;
      }
    }

    return null;
  } catch (error) {
    console.error('Error parsing XSD:', error);
    return null;
  }
}

// Hilfsfunktion: Alle Elemente flach auflisten
export function flattenNodes(node: XsdNode): XsdNode[] {
  const result: XsdNode[] = [node];
  for (const child of node.children) {
    result.push(...flattenNodes(child));
  }
  return result;
}

// Hilfsfunktion: Node nach XPath finden
export function findNodeByXpath(root: XsdNode, xpath: string): XsdNode | null {
  const allNodes = flattenNodes(root);
  return allNodes.find(n => n.xpath === xpath) || null;
}

// Hilfsfunktion: Anzeigetext für Node-Typ
export function getNodeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'schema': 'Schema',
    'element': 'Element',
    'complexType': 'Complex Type',
    'simpleType': 'Simple Type',
    'attribute': 'Attribut',
    'sequence': 'Sequence',
    'choice': 'Choice',
    'all': 'All',
    'annotation': 'Annotation',
    'documentation': 'Dokumentation',
    'restriction': 'Restriction',
    'extension': 'Extension',
    'enumeration': 'Enumeration',
    'import': 'Import',
    'include': 'Include',
  };
  return labels[type] || type;
}

// Hilfsfunktion: Icon-Farbe für Node-Typ
export function getNodeTypeColor(type: string): string {
  const colors: Record<string, string> = {
    'schema': 'text-purple-600',
    'element': 'text-blue-600',
    'complexType': 'text-green-600',
    'simpleType': 'text-teal-600',
    'attribute': 'text-orange-600',
    'sequence': 'text-gray-500',
    'choice': 'text-gray-500',
    'enumeration': 'text-pink-600',
  };
  return colors[type] || 'text-gray-600';
}
