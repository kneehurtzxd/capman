// Mock for browser environment - MINIMAL
global.window = {};

// Load libs
const AIService = require('../../lib/ai-service.js');

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ choices: [{ message: { content: 'Summary' } }] }),
  })
);

describe('AIService', () => {

    beforeEach(() => {
        fetch.mockClear();
    });

    test('replaces template variables in system prompt', async () => {
        const config = {
            model: 'gpt-model',
            systemPrompt: 'Summarize {title} by {channel}',
            apiKey: 'test-key',
            apiEndpoint: 'https://api.example.com'
        };
        const metadata = {
            title: 'My Video',
            channel: 'My Channel'
        };

        await AIService.summarize('transcript content', config, metadata);

        expect(fetch).toHaveBeenCalledTimes(1);
        const callArgs = fetch.mock.calls[0];
        const payload = JSON.parse(callArgs[1].body);

        expect(payload.messages[0].content).toBe('Summarize My Video by My Channel');
    });

    test('handles missing metadata gracefully', async () => {
        const config = {
            model: 'gpt-model',
            systemPrompt: 'Summarize {title}',
            apiKey: 'test-key',
            apiEndpoint: 'https://api.example.com'
        };

        await AIService.summarize('transcript content', config, {});
        // Should keep the placeholder if replacement not found
        // My implementation uses loop over metadata.
        // If metadata is empty, no replacement happens.

        const callArgs = fetch.mock.calls[0];
        const payload = JSON.parse(callArgs[1].body);
        expect(payload.messages[0].content).toBe('Summarize {title}');
    });
});
