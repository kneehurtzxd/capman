/**
 * Format Converter Library
 * Converts transcript segments into various file formats.
 */

const FormatConverter = {

  /**
   * Helper to pad numbers with leading zeros.
   */
  pad(num, size = 2) {
    let s = String(num);
    while (s.length < size) s = "0" + s;
    return s;
  },

  /**
   * Converts seconds to SRT timestamp format (00:00:00,000).
   */
  secondsToSRT(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(secs)},${this.pad(ms, 3)}`;
  },

  /**
   * Converts seconds to VTT timestamp format (00:00:00.000).
   */
  secondsToVTT(seconds) {
    return this.secondsToSRT(seconds).replace(',', '.');
  },

  /**
   * Converts segments to Plain Text.
   * Format: [00:00:12] Text content
   */
  toTXT(segments) {
    return segments.map(seg => {
      const timestamp = this.secondsToSRT(seg.start).split(',')[0]; // Remove ms for cleaner look? Spec shows [00:00:12]
      return `[${timestamp}] ${seg.text}`;
    }).join('\n');
  },

  /**
   * Converts segments to Markdown.
   * Format: **[00:00:12]** Text content
   */
  toMD(segments) {
    return segments.map(seg => {
      const timestamp = this.secondsToSRT(seg.start).split(',')[0];
      return `**[${timestamp}]** ${seg.text}\n`;
    }).join('\n');
  },

  /**
   * Converts segments to JSON.
   */
  toJSON(segments, metadata = {}) {
    return JSON.stringify({
      ...metadata,
      segments: segments
    }, null, 2);
  },

  /**
   * Converts segments to CSV.
   * Format: timestamp,duration,text
   */
  toCSV(segments) {
    const header = 'timestamp,duration,text\n';
    const rows = segments.map(seg => {
      const timestamp = this.secondsToSRT(seg.start).split(',')[0];
      // Escape quotes in text by doubling them
      const safeText = `"${seg.text.replace(/"/g, '""')}"`;
      return `${timestamp},${seg.duration},${safeText}`;
    }).join('\n');
    return header + rows;
  },

  /**
   * Converts segments to SRT.
   */
  toSRT(segments) {
    return segments.map((seg, index) => {
      const start = this.secondsToSRT(seg.start);
      const end = this.secondsToSRT(seg.start + seg.duration);
      return `${index + 1}\n${start} --> ${end}\n${seg.text}\n`;
    }).join('\n');
  },

  /**
   * Converts segments to VTT.
   */
  toVTT(segments) {
    const header = "WEBVTT\n\n";
    const body = segments.map(seg => {
      const start = this.secondsToVTT(seg.start);
      const end = this.secondsToVTT(seg.start + seg.duration);
      return `${start} --> ${end}\n${seg.text}\n`;
    }).join('\n');
    return header + body;
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormatConverter;
} else {
  (typeof globalThis !== 'undefined' ? globalThis : window).FormatConverter = FormatConverter;
}
