// AI Summarization Logic
// This logic will be used in background.js or wherever we decide to run the AI calls.
// Since we want to support summarization, let's add a helper function in a new file or append to background.

const AIService = {
  async summarize(transcriptText, config, metadata = {}) {
    // Process Prompt Templates
    let systemPrompt = config.systemPrompt || '';
    if (metadata) {
        for (const [key, value] of Object.entries(metadata)) {
            const regex = new RegExp(`{${key}}`, 'g');
            systemPrompt = systemPrompt.replace(regex, value);
        }
    }

    const payload = {
      model: config.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: transcriptText
        }
      ],
      // max_tokens could be configurable
    };

    try {
      const response = await fetch(config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`API Error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content;
    } catch (e) {
      console.error("AI Summarization failed:", e);
      throw e;
    }
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIService;
} else {
  (typeof globalThis !== 'undefined' ? globalThis : window).AIService = AIService;
}
