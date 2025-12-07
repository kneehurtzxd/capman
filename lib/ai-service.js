// AI Summarization Logic
// This logic will be used in background.js or wherever we decide to run the AI calls.
// Since we want to support summarization, let's add a helper function in a new file or append to background.

const AIService = {
  async summarize(transcriptText, config, metadata = {}) {
    // Validate config
    if (!config || !config.apiKey || !config.apiEndpoint) {
      throw new Error('AI configuration incomplete. Please set API key and endpoint in settings.');
    }

    if (!transcriptText || transcriptText.trim().length === 0) {
      throw new Error('Transcript is empty');
    }

    // Process Prompt Templates
    let systemPrompt = config.systemPrompt || 'Summarize the following transcript concisely.';
    if (metadata) {
        for (const [key, value] of Object.entries(metadata)) {
            const regex = new RegExp(`{${key}}`, 'g');
            systemPrompt = systemPrompt.replace(regex, value || '');
        }
    }

    const payload = {
      model: config.model || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: transcriptText.substring(0, 100000)
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
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
        let errorMsg = `HTTP ${response.status}`;
        try {
          const error = await response.json();
          errorMsg = error.error?.message || error.message || errorMsg;
        } catch (parseError) {
          errorMsg = response.statusText || errorMsg;
        }
        throw new Error(`AI API Error: ${errorMsg}`);
      }

      const data = await response.json();
      const summary = data.choices?.[0]?.message?.content;

      if (!summary) {
        throw new Error('No summary returned from AI service');
      }

      return summary;
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
