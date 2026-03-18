/**
 * Frontend input sanitization utilities.
 * Mirrors the DB-level sanitize_text / sanitize_filename functions.
 */

/**
 * Sanitize a file name — remove dangerous characters, limit length.
 */
export function sanitizeFileName(name: string): string {
  if (!name) return 'unnamed_file';

  let safe = name
    .replace(/[^a-zA-Z0-9._\- ]/g, '_') // whitelist safe chars
    .replace(/_{2,}/g, '_')              // collapse consecutive underscores
    .replace(/^_+|_+$/g, '');            // trim underscores

  if (safe.length === 0) safe = 'unnamed_file';
  if (safe.length > 255) safe = safe.slice(0, 255);

  return safe;
}

/**
 * Sanitize user-provided text — strip HTML tags, control chars, null bytes.
 */
export function sanitizeText(input: string): string {
  if (!input) return '';

  return input
    .replace(/<[^>]*>/g, '')                        // strip HTML tags
    .replace(/\x00/g, '')                            // remove null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '')  // remove control chars
    .trim();
}

/**
 * Sanitize metadata object — recursively sanitize all string values.
 */
export function sanitizeMetadata(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeText(value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeMetadata(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
