// XSD Dependency Parser - erkennt xs:import und xs:include Deklarationen

export interface XsdDependency {
  type: 'import' | 'include';
  schemaLocation: string;
  namespace?: string;
}

/**
 * Parst XSD-Content und extrahiert Import/Include Abhängigkeiten
 */
export function parseXsdDependencies(xsdContent: string): XsdDependency[] {
  const dependencies: XsdDependency[] = [];

  // Regex für xs:import und xsd:import
  const importRegex = /<(?:xs|xsd):import\s+([^>]*?)(?:\/>|>)/gi;
  // Regex für xs:include und xsd:include
  const includeRegex = /<(?:xs|xsd):include\s+([^>]*?)(?:\/>|>)/gi;

  // Imports parsen
  let match;
  while ((match = importRegex.exec(xsdContent)) !== null) {
    const attributes = match[1];
    const schemaLocation = extractAttribute(attributes, 'schemaLocation');
    const namespace = extractAttribute(attributes, 'namespace');

    if (schemaLocation) {
      dependencies.push({
        type: 'import',
        schemaLocation,
        namespace: namespace || undefined
      });
    }
  }

  // Includes parsen
  while ((match = includeRegex.exec(xsdContent)) !== null) {
    const attributes = match[1];
    const schemaLocation = extractAttribute(attributes, 'schemaLocation');

    if (schemaLocation) {
      dependencies.push({
        type: 'include',
        schemaLocation
      });
    }
  }

  return dependencies;
}

/**
 * Extrahiert ein Attribut aus einem Attribut-String
 */
function extractAttribute(attributeString: string, attributeName: string): string | null {
  // Suche nach attributeName="value" oder attributeName='value'
  const regex = new RegExp(`${attributeName}\\s*=\\s*["']([^"']+)["']`, 'i');
  const match = regex.exec(attributeString);
  return match ? match[1] : null;
}

/**
 * Extrahiert den Dateinamen aus einem schemaLocation Pfad
 */
export function extractFilename(schemaLocation: string): string {
  // Entferne Pfad-Präfixe und gib nur den Dateinamen zurück
  const parts = schemaLocation.split('/');
  return parts[parts.length - 1];
}

/**
 * Ermittelt die Rolle eines Schemas basierend auf den Abhängigkeiten
 */
export function determineSchemaRole(
  filename: string,
  allFiles: { filename: string; content: string }[]
): 'master' | 'imported' | 'included' | 'standalone' {
  // Prüfe ob dieses Schema von anderen importiert/inkludiert wird
  let isReferenced = false;
  let referencesOthers = false;

  for (const file of allFiles) {
    if (file.filename === filename) {
      // Prüfe ob dieses Schema andere referenziert
      const deps = parseXsdDependencies(file.content);
      if (deps.length > 0) {
        referencesOthers = true;
      }
    } else {
      // Prüfe ob andere Schemas dieses referenzieren
      const deps = parseXsdDependencies(file.content);
      for (const dep of deps) {
        if (extractFilename(dep.schemaLocation) === filename) {
          isReferenced = true;
          break;
        }
      }
    }
  }

  if (referencesOthers && !isReferenced) {
    return 'master';
  } else if (isReferenced) {
    // Bestimme ob import oder include basierend auf dem Typ
    for (const file of allFiles) {
      if (file.filename !== filename) {
        const deps = parseXsdDependencies(file.content);
        for (const dep of deps) {
          if (extractFilename(dep.schemaLocation) === filename) {
            return dep.type === 'import' ? 'imported' : 'included';
          }
        }
      }
    }
    return 'included'; // Fallback
  }

  return 'standalone';
}
