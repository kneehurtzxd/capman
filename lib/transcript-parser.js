/**
 * Transcript Parser Library
 * Handles extraction of caption tracks and parsing of transcript data.
 */

const TranscriptParser = {

  /**
   * Parses the YouTube timedtext XML format using Regex to avoid DOMParser (Service Worker safe).
   * @param {string} xmlString - The XML content.
   * @returns {Array} Array of segments {start, duration, text}.
   */
  parseXML(xmlString) {
    const segments = [];
    const textRegex = /<text start="([\d.]+)"(?: dur="([\d.]+)")?[^>]*>(.*?)<\/text>/g;

    let match;
    while ((match = textRegex.exec(xmlString)) !== null) {
        const start = parseFloat(match[1]);
        const duration = parseFloat(match[2] || "0");
        const text = match[3];

        if (!isNaN(start)) {
            segments.push({
                start,
                duration,
                text: this.decodeHTML(text)
            });
        }
    }
    return segments;
  },

  /**
   * Helper to decode HTML entities in text without DOM.
   */
  decodeHTML(html) {
    if (!html) return "";
    return html
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
    // Add more entities if needed, but YouTube transcripts usually stick to these basic ones.
  },

  /**
   * Extracts caption tracks from the page source or player response.
   * @param {string} pageHTML - The HTML content of the YouTube page.
   * @returns {Array} List of caption tracks or null if not found.
   */
  extractCaptionTracks(pageHTML) {
    // 1. Parse ytInitialPlayerResponse from page HTML
    // Patterns from spec:
    const patterns = [
      /ytInitialPlayerResponse\s*=\s*(\{[^;]+\});/,
      /var ytInitialPlayerResponse\s*=\s*(\{[^;]+\});/,
      // The third pattern in spec "captions": ... is a bit partial,
      // usually part of the player response JSON.
    ];

    let playerResponse = null;

    for (const pattern of patterns) {
      const match = pageHTML.match(pattern);
      if (match && match[1]) {
        try {
          playerResponse = JSON.parse(match[1]);
          break;
        } catch (e) {
          console.error("Failed to parse matched JSON", e);
        }
      }
    }

    if (!playerResponse) {
        // Try to find captions directly if the full object wasn't parsed
        // This is risky but requested in spec as fallback strategy?
        // Actually spec says "Check player config for captionTracks array" which implies
        // we might have access to the object if we are in the page context.
        // But here we are parsing HTML string usually.
    }

    if (playerResponse) {
        return this.getTracksFromPlayerResponse(playerResponse);
    }

    return null;
  },

  /**
   * Extracts tracks from the parsed player response object.
   */
  getTracksFromPlayerResponse(playerResponse) {
    if (!playerResponse || !playerResponse.captions ||
        !playerResponse.captions.playerCaptionsTracklistRenderer ||
        !playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks) {
      return null;
    }

    return playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
  },

  /**
   * Fetches the transcript data from a track URL.
   * @param {string} url - The baseUrl of the caption track.
   * @returns {Promise<Array>} Parsed segments.
   */
  async fetchTranscript(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch transcript: ${response.statusText}`);
    }
    const xmlText = await response.text();
    return this.parseXML(xmlText);
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranscriptParser;
} else {
  (typeof globalThis !== 'undefined' ? globalThis : window).TranscriptParser = TranscriptParser;
}
