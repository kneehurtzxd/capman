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

    for (const url of urls) {
        current++;
        let videoId = null;
        try {
            // Normalize URL/ID
            if (url.match(/^[a-zA-Z0-9_-]{11}$/)) {
                videoId = url;
            } else {
                const u = new URL(url);
                videoId = u.searchParams.get('v');
                if (!videoId && u.hostname === 'youtu.be') {
                    videoId = u.pathname.slice(1);
                }
            }
        } catch (e) {
            console.warn("Invalid URL:", url);
        }

        if (!videoId) {
            notifyProgress(total, current, "Invalid URL", url, false);
            continue;
        }

        notifyProgress(total, current, "Processing...", videoId);

        try {
            await limiter.executeWithRetry(async () => {
                 const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
                 if (!res.ok) throw new Error("Video page unreachable");

                 const html = await res.text();
                 // Now strictly using Regex based parser in background
                 const tracks = TranscriptParser.extractCaptionTracks(html);

                 if (!tracks || tracks.length === 0) {
                     throw new Error("No captions found");
                 }

                 // Prefer English or first available
                 let track = tracks.find(t => t.languageCode === 'en');
                 if (!track) track = tracks[0];

                 const segments = await TranscriptParser.fetchTranscript(track.baseUrl);

                 // Extract title from HTML via Regex
                 const titleMatch = html.match(/<title>(.*?) - YouTube<\/title>/);
                 const title = titleMatch ? titleMatch[1] : `Video ${videoId}`;

                 // Use settings for format? For now default to txt
                 const formats = ['txt'];

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
            notifyProgress(total, current, `Failed: ${err.message}`, videoId, false);
        }
    }
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
  if (withSummary && settings.ai && settings.ai.apiKey) {
      try {
          const fullText = segments.map(s => s.text).join(' ');
          // Pass metadata for template replacement
          const metadata = {
              title: title,
              videoId: videoId,
              language: language,
              // channel: channel // if we had it
          };
          summaryContent = await AIService.summarize(fullText, settings.ai, metadata);
      } catch (e) {
          console.error("Summary generation failed", e);
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
