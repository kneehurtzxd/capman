importScripts('lib/sanitize.js', 'lib/format-converter.js', 'lib/rate-limiter.js', 'lib/transcript-parser.js', 'lib/storage-manager.js', 'lib/ai-service.js');

const limiter = new RateLimiter(2, 1500);

// Initialize storage defaults
StorageManager.init();

// Listener for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadTranscript') {
    handleDownload(request.data)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'startBatch') {
      processBatch(request.urls);
      sendResponse({ started: true });
  }
});

async function processBatch(urls) {
    const total = urls.length;
    let current = 0;
    const storage = await StorageManager.getAll();
    const settings = storage.settings || StorageManager.defaults.settings;

    for (const url of urls) {
        current++;
        let videoId = null;
        const trimmedUrl = url.trim();

        if (!trimmedUrl) {
            continue;
        }

        try {
            // Normalize URL/ID
            if (trimmedUrl.match(/^[a-zA-Z0-9_-]{11}$/)) {
                videoId = trimmedUrl;
            } else {
                const u = new URL(trimmedUrl);
                videoId = u.searchParams.get('v');
                if (!videoId && u.hostname === 'youtu.be') {
                    videoId = u.pathname.slice(1).split('?')[0];
                }
            }
        } catch (e) {
            console.warn("Invalid URL:", trimmedUrl, e);
            notifyProgress(total, current, "Invalid URL format", trimmedUrl.substring(0, 20), false);
            continue;
        }

        if (!videoId || videoId.length !== 11) {
            notifyProgress(total, current, "Invalid video ID", trimmedUrl.substring(0, 20), false);
            continue;
        }

        notifyProgress(total, current, "Fetching...", videoId);

        try {
            await limiter.executeWithRetry(async () => {
                 const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
                 if (!res.ok) {
                     throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                 }

                 const html = await res.text();

                 // Check if video exists
                 if (html.includes('"playabilityStatus":{"status":"ERROR"')) {
                     throw new Error("Video unavailable");
                 }

                 const tracks = TranscriptParser.extractCaptionTracks(html);

                 if (!tracks || tracks.length === 0) {
                     throw new Error("No captions available");
                 }

                 // Prefer user's default language, then English, then first available
                 let track = tracks.find(t => t.languageCode === settings.defaultLanguage);
                 if (!track) track = tracks.find(t => t.languageCode === 'en');
                 if (!track) track = tracks[0];

                 notifyProgress(total, current, "Downloading...", videoId);
                 const segments = await TranscriptParser.fetchTranscript(track.baseUrl);

                 if (!segments || segments.length === 0) {
                     throw new Error("Empty transcript");
                 }

                 // Extract title from HTML via Regex
                 const titleMatch = html.match(/<title>(.*?) - YouTube<\/title>/);
                 const title = titleMatch ? titleMatch[1] : `Video ${videoId}`;

                 // Use user's default format
                 const formats = [settings.defaultFormat || 'txt'];

                 await handleDownload({
                     videoId,
                     title: TranscriptParser.decodeHTML(title),
                     segments,
                     formats,
                     language: track.languageCode
                 });
            });
            notifyProgress(total, current, "Completed", videoId, true);
        } catch (err) {
            console.error(videoId, err);
            const errorMsg = err.message || "Unknown error";
            notifyProgress(total, current, `Failed: ${errorMsg}`, videoId, false);
        }
    }

    notifyProgress(total, total, "Batch complete", `${total} videos processed`, null);
}

function notifyProgress(total, current, status, videoId, success) {
    chrome.runtime.sendMessage({
        action: 'batchProgress',
        data: { total, current, status, videoId, success }
    }).catch(() => {
        // Popup might be closed, ignore
    });
}

/**
 * Handles the download process.
 * @param {object} data - { videoId, title, segments, formats, language }
 */
async function handleDownload(data) {
  const { videoId, title, segments, formats, language, withSummary } = data;

  // Get settings for template and AI
  const storage = await StorageManager.getAll();
  const settings = storage.settings || StorageManager.defaults.settings;
  const template = settings.filenameTemplate || "{date}_{title}_{videoId}.{ext}";
  const date = new Date().toISOString().split('T')[0];

  // AI Summary Handling
  let summaryContent = null;
  if (withSummary) {
      if (!settings.ai || !settings.ai.apiKey) {
          chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icons/icon-48.png',
              title: 'AI Summary Not Configured',
              message: 'Please configure your AI API key in settings to enable summarization.'
          });
      } else {
          try {
              const fullText = segments.map(s => s.text).join(' ');
              const metadata = {
                  title: title,
                  videoId: videoId,
                  language: language
              };
              summaryContent = await AIService.summarize(fullText, settings.ai, metadata);
              chrome.notifications.create({
                  type: 'basic',
                  iconUrl: 'icons/icon-48.png',
                  title: 'Summary Generated',
                  message: `Summary created for "${title}"`
              });
          } catch (e) {
              console.error("Summary generation failed", e);
              chrome.notifications.create({
                  type: 'basic',
                  iconUrl: 'icons/icon-48.png',
                  title: 'Summary Failed',
                  message: `Failed to generate summary: ${e.message}`
              });
          }
      }
  }

  // Loop through requested formats
  for (const format of formats) {
    let content = '';

    switch (format) {
      case 'txt': content = FormatConverter.toTXT(segments); break;
      case 'md': content = FormatConverter.toMD(segments); break;
      case 'json': content = FormatConverter.toJSON(segments, { videoId, title, language }); break;
      case 'csv': content = FormatConverter.toCSV(segments); break;
      case 'srt': content = FormatConverter.toSRT(segments); break;
      case 'vtt': content = FormatConverter.toVTT(segments); break;
    }

    const filename = Sanitizer.generateFilename(template, {
      date,
      title,
      videoId,
      channel: 'YouTube', // We might want to extract this too in content script
      lang: language,
      ext: format
    });

    await downloadFile(content, filename);
  }

  if (summaryContent) {
      const summaryFilename = Sanitizer.generateFilename(template, {
          date,
          title: title + "_Summary",
          videoId,
          channel: 'YouTube',
          lang: language,
          ext: 'md'
      });
      await downloadFile(summaryContent, summaryFilename);
  }

  // Update History
  await StorageManager.addHistoryItem(videoId, {
      title,
      downloadedAt: Date.now(),
      formats,
      language,
      hasSummary: !!summaryContent
  });

  // Success notification
  const formatList = formats.join(', ');
  chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'Download Complete',
      message: `"${title}" downloaded as ${formatList}${summaryContent ? ' with summary' : ''}`
  });
}

async function downloadFile(content, filename) {
    // Convert string content to Blob to Data URL
    const blob = new Blob([content], { type: 'text/plain' });
    const reader = new FileReader();

    // We need to wait for FileReader
    await new Promise((resolve, reject) => {
        reader.onloadend = () => {
            const url = reader.result;
            chrome.downloads.download({
                url: url,
                filename: filename,
                saveAs: false
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(downloadId);
                }
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
