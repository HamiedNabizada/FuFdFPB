/**
 * Utility functions for Base36 ID encoding/decoding
 *
 * Base36 uses 0-9 and a-z, making IDs shorter and more readable:
 * - ID 1000 → "rs"
 * - ID 10000 → "7ps"
 * - ID 100000 → "255s"
 */

/**
 * Convert a numeric ID to Base36 string
 */
export function toBase36(id: number): string {
  return id.toString(36).toLowerCase();
}

/**
 * Convert a Base36 string back to numeric ID
 */
export function fromBase36(str: string): number {
  return parseInt(str.toLowerCase(), 36);
}

/**
 * Format an entity ID for display (e.g., "G-rs", "C-7ps")
 */
export function formatId(prefix: string, id: number): string {
  return `${prefix}-${toBase36(id)}`;
}

/**
 * Parse a formatted ID string (e.g., "G-rs" → { prefix: "G", id: 1000 })
 */
export function parseId(formatted: string): { prefix: string; id: number } | null {
  const match = formatted.match(/^([GSCRU])-([a-z0-9]+)$/i);
  if (!match) return null;

  return {
    prefix: match[1].toUpperCase(),
    id: fromBase36(match[2])
  };
}
