// Content Script for YouTube Transcript Downloader

let currentVideoId = null;
let currentCaptionTracks = [];

/**
 * Initializes the content script.
 */
function init() {
  // Check if we are on a video page
  checkPage();

  // Listen for navigation events (YouTube is SPA)
  // 'yt-navigate-finish' is a custom event fired by YouTube app
  document.addEventListener('yt-navigate-finish', checkPage);

  // Fallback: MutationObserver to detect URL changes if custom event fails
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      checkPage();
    }
  }).observe(document, {subtree: true, childList: true});

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openModal') {
      openModal();
      sendResponse({ success: true });
    }
    return true;
  });
}

/**
 * Checks if the current page is a video page and injects UI.
 */
function checkPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get('v');

  if (videoId && videoId !== currentVideoId) {
    currentVideoId = videoId;
    injectButton();
    // Attempt to extract tracks immediately to be ready
    extractTracks();
  } else if (!videoId) {
    removeButton();
    currentVideoId = null;
  }
}

/**
 * Extracts caption tracks using the TranscriptParser library.
 */
function extractTracks() {
  // Pass the full HTML of the page (or documentElement) to the parser
  // Note: The parser logic relies on ytInitialPlayerResponse.
  // Ideally, we should inject a script to get the actual JS object,
  // but let's try the HTML regex parsing first as per spec fallback.

  const html = document.documentElement.innerHTML;
  const tracks = TranscriptParser.extractCaptionTracks(html);

  currentCaptionTracks = tracks || [];
  console.log('YouTube Transcript Downloader: Tracks found:', currentCaptionTracks);
}

/**
 * Injects the floating download button.
 */
function injectButton() {
  if (document.getElementById('yt-transcript-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'yt-transcript-btn';
  btn.innerHTML = '⬇️'; // Simple icon for now
  btn.title = 'Download Transcript';
  btn.onclick = openModal;

  document.body.appendChild(btn);
}

/**
 * Removes the download button.
 */
function removeButton() {
  const btn = document.getElementById('yt-transcript-btn');
  if (btn) btn.remove();
}

/**
 * Opens the download configuration modal.
 */
function openModal() {
  if (document.getElementById('yt-transcript-modal-overlay')) return;

  // Re-check tracks if empty (maybe page wasn't fully loaded before)
  if (!currentCaptionTracks || currentCaptionTracks.length === 0) {
    extractTracks();
  }

  const overlay = document.createElement('div');
  overlay.id = 'yt-transcript-modal-overlay';

  // Basic Modal HTML
  overlay.innerHTML = `
    <div id="yt-transcript-modal">
      <div class="yt-modal-header">
        <h2>Download Transcript</h2>
        <button class="yt-modal-close">&times;</button>
      </div>

      <div class="yt-modal-body">
        <div id="yt-error-display" class="yt-error-msg"></div>

        <div class="yt-form-group">
          <label for="yt-lang-select">Language:</label>
          <select id="yt-lang-select" class="yt-select">
            ${generateLanguageOptions()}
          </select>
        </div>

        <div class="yt-form-group">
          <label>Formats:</label>
          <div class="yt-checkbox-group">
            <label class="yt-checkbox-label"><input type="checkbox" value="txt" checked> .txt</label>
            <label class="yt-checkbox-label"><input type="checkbox" value="md"> .md</label>
            <label class="yt-checkbox-label"><input type="checkbox" value="json"> .json</label>
            <label class="yt-checkbox-label"><input type="checkbox" value="csv"> .csv</label>
            <label class="yt-checkbox-label"><input type="checkbox" value="srt"> .srt</label>
            <label class="yt-checkbox-label"><input type="checkbox" value="vtt"> .vtt</label>
          </div>
        </div>

        <div class="yt-form-group">
            <label class="yt-checkbox-label" style="font-weight: bold !important;">
                <input type="checkbox" id="yt-ai-toggle"> Summarize with AI
            </label>
        </div>
      </div>

      <div class="yt-modal-footer">
        <button class="yt-btn yt-btn-secondary" id="yt-cancel-btn">Cancel</button>
        <button class="yt-btn yt-btn-primary" id="yt-download-btn">Download</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Event Listeners
  overlay.querySelector('.yt-modal-close').onclick = closeModal;
  overlay.querySelector('#yt-cancel-btn').onclick = closeModal;
  overlay.querySelector('#yt-download-btn').onclick = handleDownload;
  overlay.onclick = (e) => {
    if (e.target === overlay) closeModal();
  };

  // Check if we have tracks
  if (currentCaptionTracks.length === 0) {
    showError("No captions found for this video.");
    document.getElementById('yt-download-btn').disabled = true;
  }
}

function closeModal() {
  const overlay = document.getElementById('yt-transcript-modal-overlay');
  if (overlay) overlay.remove();
}

function showError(msg) {
  const el = document.getElementById('yt-error-display');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

function generateLanguageOptions() {
  if (!currentCaptionTracks || currentCaptionTracks.length === 0) {
    return '<option disabled>No languages available</option>';
  }

  // Sort: User's language -> English -> Others
  const userLang = navigator.language.split('-')[0];

  return currentCaptionTracks.map((track, index) => {
    const isDefault = (track.languageCode.startsWith(userLang)) ||
                      (track.languageCode === 'en' && index === 0); // Simplified default logic
    return `<option value="${index}" ${isDefault ? 'selected' : ''}>${track.name.simpleText} (${track.languageCode})</option>`;
  }).join('');
}

async function handleDownload() {
  const btn = document.getElementById('yt-download-btn');
  btn.disabled = true;
  btn.textContent = 'Processing...';

  try {
    const langIndex = document.getElementById('yt-lang-select').value;
    const track = currentCaptionTracks[langIndex];

    if (!track) throw new Error("No track selected");

    // Get selected formats
    const formats = Array.from(document.querySelectorAll('.yt-checkbox-group input:checked'))
      .map(cb => cb.value);

    if (formats.length === 0) {
        throw new Error("Please select at least one format.");
    }

    // Fetch transcript
    const segments = await TranscriptParser.fetchTranscript(track.baseUrl);
    const withSummary = document.getElementById('yt-ai-toggle').checked;

    // Prepare data for download
    // We send data to background script to handle the actual download (browser.downloads API)
    // because content scripts can't access downloads API directly usually (though they can create blob links).
    // Using background script allows better management.

    const videoTitle = document.title.replace(' - YouTube', '');

    chrome.runtime.sendMessage({
      action: 'downloadTranscript',
      data: {
        videoId: currentVideoId,
        title: videoTitle,
        segments: segments,
        formats: formats,
        language: track.languageCode,
        withSummary: withSummary
      }
    }, (response) => {
        if (chrome.runtime.lastError) {
             showError(chrome.runtime.lastError.message);
             btn.disabled = false;
             btn.textContent = 'Download';
        } else if (response && response.success) {
            closeModal();
        } else {
            showError("Download failed: " + (response ? response.error : 'Unknown error'));
            btn.disabled = false;
            btn.textContent = 'Download';
        }
    });

  } catch (e) {
    console.error(e);
    showError(e.message);
    btn.disabled = false;
    btn.textContent = 'Download';
  }
}

// Start
init();
