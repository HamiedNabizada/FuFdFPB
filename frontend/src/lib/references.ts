/**
 * Reference parsing utilities for @G-X, @S-X, @C-X, @R-X mentions
 */

export type ReferenceType = 'group' | 'schema' | 'comment' | 'reply';

export interface Reference {
  type: ReferenceType;
  id: number;
  fullMatch: string;
  prefix: string;
}

// Pattern to match @G-123, @S-456, @C-789, @R-012
const REFERENCE_PATTERN = /@([GSCR])-(\d+)/gi;

/**
 * Parse text and extract all references
 */
export function parseReferences(text: string): Reference[] {
  const references: Reference[] = [];
  let match: RegExpExecArray | null;

  // Reset lastIndex for global regex
  REFERENCE_PATTERN.lastIndex = 0;

  while ((match = REFERENCE_PATTERN.exec(text)) !== null) {
    const prefix = match[1].toUpperCase();
    const id = parseInt(match[2], 10);

    let type: ReferenceType;
    switch (prefix) {
      case 'G': type = 'group'; break;
      case 'S': type = 'schema'; break;
      case 'C': type = 'comment'; break;
      case 'R': type = 'reply'; break;
      default: continue;
    }

    references.push({
      type,
      id,
      fullMatch: match[0],
      prefix
    });
  }

  return references;
}

/**
 * Get the URL for a reference
 */
export function getReferenceUrl(ref: Reference, currentGroupId?: number): string {
  switch (ref.type) {
    case 'group':
      return `/group/${ref.id}`;
    case 'schema':
      // Schema links should go to the group with the schema selected
      // We'd need the groupId to create a proper link - for now just use schema param
      return currentGroupId
        ? `/group/${currentGroupId}?schemaId=${ref.id}`
        : `/group/1?schemaId=${ref.id}`; // Fallback
    case 'comment':
      // Comments are trickier - we'd need to know which group/schema they belong to
      // For now, just anchor to the comment ID
      return `#comment-${ref.id}`;
    case 'reply':
      return `#reply-${ref.id}`;
    default:
      return '#';
  }
}

/**
 * Get display label for reference type
 */
export function getReferenceLabel(type: ReferenceType): string {
  switch (type) {
    case 'group': return 'Gruppe';
    case 'schema': return 'Schema';
    case 'comment': return 'Kommentar';
    case 'reply': return 'Antwort';
    default: return '';
  }
}

/**
 * Convert references to markdown links
 * This is useful when the text will be processed by ReactMarkdown
 */
export function convertReferencesToMarkdown(text: string, currentGroupId?: number): string {
  REFERENCE_PATTERN.lastIndex = 0;

  return text.replace(REFERENCE_PATTERN, (match, prefix: string, idStr: string) => {
    const upperPrefix = prefix.toUpperCase();
    const id = parseInt(idStr, 10);

    let refType: ReferenceType;
    switch (upperPrefix) {
      case 'G': refType = 'group'; break;
      case 'S': refType = 'schema'; break;
      case 'C': refType = 'comment'; break;
      case 'R': refType = 'reply'; break;
      default: return match;
    }

    const ref: Reference = { type: refType, id, fullMatch: match, prefix: upperPrefix };
    const url = getReferenceUrl(ref, currentGroupId);

    // Return as markdown link with special styling class hint
    return `[${match}](${url})`;
  });
}

/**
 * Split text into parts - regular text and references
 */
export interface TextPart {
  type: 'text' | 'reference';
  content: string;
  reference?: Reference;
}

export function splitTextWithReferences(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  REFERENCE_PATTERN.lastIndex = 0;

  while ((match = REFERENCE_PATTERN.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }

    // Parse the reference
    const prefix = match[1].toUpperCase();
    const id = parseInt(match[2], 10);

    let refType: ReferenceType;
    switch (prefix) {
      case 'G': refType = 'group'; break;
      case 'S': refType = 'schema'; break;
      case 'C': refType = 'comment'; break;
      case 'R': refType = 'reply'; break;
      default: continue;
    }

    parts.push({
      type: 'reference',
      content: match[0],
      reference: {
        type: refType,
        id,
        fullMatch: match[0],
        prefix
      }
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }

  return parts;
}
