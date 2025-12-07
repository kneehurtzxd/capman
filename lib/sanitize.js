/**
 * Sanitizes a string for use as a filename.
 * @param {string} title - The original title/string.
 * @param {number} maxLength - Maximum length for the filename.
 * @returns {string} Sanitized string.
 */
function sanitizeFilename(title, maxLength = 120) {
  return title
    // Decode HTML entities (basic set)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

    // Remove filesystem-illegal characters
    .replace(/[/\\?%*:|"<>]/g, '_')

    // Remove control characters
    .replace(/[\x00-\x1f\x80-\x9f]/g, '_')

    // Handle leading dots (hidden files)
    .replace(/^\.+/, '_')

    // Handle trailing dots (Windows compatibility)
    .replace(/\.+$/, '_')

    // Normalize whitespace
    .replace(/\s+/g, '_')

    // Collapse multiple underscores
    .replace(/_{2,}/g, '_')

    // Length limit
    .substring(0, maxLength);
}

/**
 * Generates a filename based on a template and data.
 * @param {string} template - The filename template (e.g., "{date}_{title}").
 * @param {object} data - Data to populate the template.
 * @returns {string} The generated filename.
 */
function generateFilename(template, data) {
  let filename = template;

  // Replace variables
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{${key}}`, 'g');
    const safeValue = key === 'title' || key === 'channel'
      ? sanitizeFilename(String(value))
      : String(value);
    filename = filename.replace(regex, safeValue);
  }

  // Sanitize the final result just in case (e.g. if template added bad chars)
  // But we want to keep dots for extension if it was part of template logic,
  // though usually extension is added after.
  // The spec says template includes {ext}, so we should handle that.

  return filename;
}

// Export for module usage (if using modules) or global if loaded via script tag
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sanitizeFilename, generateFilename };
} else {
  // For browser context without modules
  (typeof globalThis !== 'undefined' ? globalThis : window).Sanitizer = {
    sanitizeFilename,
    generateFilename
  };
}
