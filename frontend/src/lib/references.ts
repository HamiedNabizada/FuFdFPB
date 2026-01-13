/**
 * Reference parsing utilities for @G-X, @S-X, @C-X, @R-X, @U-X mentions
 * Uses Base36 encoding for shorter, more readable IDs
 */

import { fromBase36 } from './id-utils';

export type ReferenceType = 'group' | 'schema' | 'comment' | 'reply' | 'user';

export interface Reference {
  type: ReferenceType;
  id: number;
  fullMatch: string;
  prefix: string;
  base36Id: string;
}

// Pattern to match @G-abc, @S-123, @C-7ps, @R-rs, @U-a (alphanumeric Base36 IDs)
const REFERENCE_PATTERN = /@([GSCRU])-([a-z0-9]+)/gi;

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
    const base36Id = match[2].toLowerCase();
    const id = fromBase36(base36Id);

    let type: ReferenceType;
    switch (prefix) {
      case 'G': type = 'group'; break;
      case 'S': type = 'schema'; break;
      case 'C': type = 'comment'; break;
      case 'R': type = 'reply'; break;
      case 'U': type = 'user'; break;
      default: continue;
    }

    references.push({
      type,
      id,
      fullMatch: match[0],
      prefix,
      base36Id
    });
  }

  return references;
}

/**
 * Get the URL for a reference (used as fallback, API resolution is preferred)
 */
export function getReferenceUrl(ref: Reference, currentGroupId?: number): string {
  switch (ref.type) {
    case 'group':
      return `/group/${ref.id}`;
    case 'schema':
      return currentGroupId
        ? `/group/${currentGroupId}?schemaId=${ref.id}`
        : `/group/1?schemaId=${ref.id}`;
    case 'comment':
      return `#comment-${ref.id}`;
    case 'reply':
      return `#reply-${ref.id}`;
    case 'user':
      return '#'; // Users don't have profile pages
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
    case 'user': return 'Benutzer';
    default: return '';
  }
}

/**
 * Convert references to markdown links
 * This is useful when the text will be processed by ReactMarkdown
 */
export function convertReferencesToMarkdown(text: string, currentGroupId?: number): string {
  REFERENCE_PATTERN.lastIndex = 0;

  return text.replace(REFERENCE_PATTERN, (match, prefix: string, base36Id: string) => {
    const upperPrefix = prefix.toUpperCase();
    const id = fromBase36(base36Id.toLowerCase());

    let refType: ReferenceType;
    switch (upperPrefix) {
      case 'G': refType = 'group'; break;
      case 'S': refType = 'schema'; break;
      case 'C': refType = 'comment'; break;
      case 'R': refType = 'reply'; break;
      case 'U': refType = 'user'; break;
      default: return match;
    }

    const ref: Reference = { type: refType, id, fullMatch: match, prefix: upperPrefix, base36Id: base36Id.toLowerCase() };

    // User references don't have URLs, keep as special marker
    if (refType === 'user') {
      return `[@U-${base36Id.toLowerCase()}](#user-${id})`;
    }

    const url = getReferenceUrl(ref, currentGroupId);

    // Return as markdown link - keep original format for display
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
    const base36Id = match[2].toLowerCase();
    const id = fromBase36(base36Id);

    let refType: ReferenceType;
    switch (prefix) {
      case 'G': refType = 'group'; break;
      case 'S': refType = 'schema'; break;
      case 'C': refType = 'comment'; break;
      case 'R': refType = 'reply'; break;
      case 'U': refType = 'user'; break;
      default: continue;
    }

    parts.push({
      type: 'reference',
      content: match[0],
      reference: {
        type: refType,
        id,
        fullMatch: match[0],
        prefix,
        base36Id
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
