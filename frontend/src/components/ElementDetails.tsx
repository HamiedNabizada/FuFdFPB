import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, BookOpen, HelpCircle, Info } from 'lucide-react';
import hljs from 'highlight.js/lib/core';
import xml from 'highlight.js/lib/languages/xml';
import 'highlight.js/styles/github.css';
import { getNodeTypeLabel } from '../lib/xsd-parser';
import type { XsdNode } from '../lib/xsd-parser';

// Register XML language
hljs.registerLanguage('xml', xml);

// XSD-Attribut-Erklärungen
const ATTRIBUTE_EXPLANATIONS: Record<string, (value: string) => string | null> = {
  minOccurs: (value) => {
    if (value === '0') return 'Optional – kann weggelassen werden';
    if (value === '1') return 'Pflichtfeld – muss genau einmal vorkommen';
    return `Muss mindestens ${value}x vorkommen`;
  },
  maxOccurs: (value) => {
    if (value === 'unbounded') return 'Kann beliebig oft vorkommen';
    if (value === '1') return 'Darf höchstens einmal vorkommen';
    return `Darf maximal ${value}x vorkommen`;
  },
  type: (value) => {
    const typeExplanations: Record<string, string> = {
      'xs:string': 'Text-Wert (beliebige Zeichenkette)',
      'xs:integer': 'Ganzzahl (ohne Nachkommastellen)',
      'xs:decimal': 'Dezimalzahl (mit Nachkommastellen)',
      'xs:boolean': 'Wahrheitswert (true/false)',
      'xs:date': 'Datum (YYYY-MM-DD)',
      'xs:dateTime': 'Datum mit Uhrzeit',
      'xs:time': 'Uhrzeit (HH:MM:SS)',
      'xs:anyURI': 'URI/URL (Webadresse)',
      'xs:ID': 'Eindeutiger Bezeichner (muss im Dokument einzigartig sein)',
      'xs:IDREF': 'Referenz auf einen ID-Wert',
      'xs:positiveInteger': 'Positive Ganzzahl (> 0)',
      'xs:nonNegativeInteger': 'Nicht-negative Ganzzahl (≥ 0)',
    };
    return typeExplanations[value] || null;
  },
  use: (value) => {
    if (value === 'required') return 'Pflichtattribut – muss angegeben werden';
    if (value === 'optional') return 'Optionales Attribut';
    if (value === 'prohibited') return 'Verboten – darf nicht verwendet werden';
    return null;
  },
  default: (value) => `Standardwert: "${value}" (wird verwendet wenn nicht angegeben)`,
  fixed: (value) => `Fester Wert: "${value}" (kann nicht geändert werden)`,
  ref: (value) => `Referenz auf das Element "${value.includes(':') ? value.split(':')[1] : value}"`,
  base: (value) => `Basiert auf dem Typ "${value.includes(':') ? value.split(':')[1] : value}"`,
  namespace: (value) => {
    if (value === '##other') return 'Erlaubt Attribute aus anderen Namespaces';
    if (value === '##any') return 'Erlaubt Attribute aus beliebigen Namespaces';
    if (value === '##local') return 'Erlaubt nur Attribute ohne Namespace';
    return `Namespace: ${value}`;
  },
};

// XSD-Elementtyp-Erklärungen
const TYPE_EXPLANATIONS: Record<string, string> = {
  element: 'Definiert ein XML-Element, das in Instanzdokumenten verwendet werden kann',
  complexType: 'Definiert einen komplexen Typ, der andere Elemente und/oder Attribute enthalten kann',
  simpleType: 'Definiert einen einfachen Typ mit Einschränkungen (z.B. nur bestimmte Werte erlaubt)',
  attribute: 'Definiert ein XML-Attribut für ein Element',
  sequence: 'Die Kindelemente müssen in genau dieser Reihenfolge erscheinen',
  choice: 'Nur eines der Kindelemente darf verwendet werden (Auswahl)',
  all: 'Alle Kindelemente müssen vorkommen, aber in beliebiger Reihenfolge',
  restriction: 'Schränkt einen Basistyp ein (z.B. nur bestimmte Werte oder Längenbegrenzungen)',
  extension: 'Erweitert einen Basistyp um zusätzliche Elemente oder Attribute',
  enumeration: 'Definiert einen erlaubten Wert (einer von mehreren möglichen)',
  annotation: 'Enthält Dokumentation oder Anwendungsinformationen',
  documentation: 'Menschenlesbare Beschreibung des Elements',
  import: 'Importiert Definitionen aus einem anderen Schema (anderer Namespace)',
  include: 'Fügt Definitionen aus einem anderen Schema hinzu (gleicher Namespace)',
  anyAttribute: 'Erlaubt beliebige zusätzliche Attribute aus anderen Namespaces',
  any: 'Erlaubt beliebige zusätzliche Elemente',
};

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

  // Erklärung für Attribute berechnen
  const getAttributeExplanation = (key: string, value: string): string | null => {
    const explainFn = ATTRIBUTE_EXPLANATIONS[key];
    if (explainFn) {
      return explainFn(value);
    }
    return null;
  };

  // Typ-Erklärung
  const typeExplanation = TYPE_EXPLANATIONS[node.type] || null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-primary-900">{node.name || '(unnamed)'}</h2>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm text-primary-500">{getNodeTypeLabel(node.type)}</span>
          {typeExplanation && (
            <span title={typeExplanation} className="cursor-help">
              <HelpCircle className="w-4 h-4 text-primary-400 hover:text-primary-600" />
            </span>
          )}
        </div>
        {/* Typ-Erklärung inline anzeigen */}
        {typeExplanation && (
          <p className="text-xs text-primary-500 mt-1 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            {typeExplanation}
          </p>
        )}
      </div>

      {/* Documentation - prominenter */}
      <div className={`rounded-lg p-4 ${node.documentation ? 'bg-blue-50 border border-blue-200' : 'bg-primary-50 border border-primary-200'}`}>
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className={`w-4 h-4 ${node.documentation ? 'text-blue-600' : 'text-primary-400'}`} />
          <h3 className={`text-sm font-medium ${node.documentation ? 'text-blue-800' : 'text-primary-500'}`}>
            Schema-Dokumentation
          </h3>
        </div>
        {node.documentation ? (
          <p className="text-sm text-blue-900">{node.documentation}</p>
        ) : (
          <p className="text-sm text-primary-400 italic">
            Keine Dokumentation im Schema hinterlegt.
            Dokumentation kann über xs:annotation/xs:documentation im XSD ergänzt werden.
          </p>
        )}
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

      {/* Attributes mit Erklärungen */}
      {Object.keys(node.attributes).length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-primary-500 uppercase tracking-wide mb-2">
            Attribute
          </h3>
          <div className="space-y-2">
            {Object.entries(node.attributes).map(([key, value]) => {
              const explanation = getAttributeExplanation(key, value);
              return (
                <div key={key} className="bg-primary-50 rounded-lg p-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-sm text-primary-700 font-medium">{key}</span>
                    <span className="text-sm text-primary-600">=</span>
                    <span className="font-mono text-sm text-primary-800">"{value}"</span>
                  </div>
                  {explanation && (
                    <p className="text-xs text-primary-500 mt-1 flex items-start gap-1.5">
                      <Info className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary-400" />
                      {explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
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
                className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-white rounded text-primary-500 hover:text-primary-700 transition-colors z-10"
                title="Code kopieren"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-accent-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <pre className="text-xs font-mono bg-primary-50 p-3 rounded border border-primary-200 overflow-x-auto max-h-64 overflow-y-auto">
                <code
                  className="hljs language-xml"
                  dangerouslySetInnerHTML={{
                    __html: hljs.highlight(codeSnippet, { language: 'xml' }).value
                  }}
                />
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
