document.addEventListener('DOMContentLoaded', async () => {
  // Init Storage
  await StorageManager.init();

  // Load Projects
  await loadProjects();

  // Load History
  await loadHistory();

  // Tabs Logic
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      // Deactivate all
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      // Activate clicked
      tab.classList.add('active');
      document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');

      // Reload history when tab is opened
      if (tab.dataset.tab === 'history') {
        await loadHistory();
      }
    });
  });

  // Open Settings
  document.getElementById('open-settings-btn').addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options/options.html'));
    }
  });

  // Quick Tab: Check for current video
  checkCurrentTab();

  document.getElementById('scrape-page-btn').addEventListener('click', scrapeCurrentPage);
  document.getElementById('start-batch-btn').addEventListener('click', startBatchDownload);

  // Project handlers
  document.getElementById('create-project-btn').addEventListener('click', createProject);
  document.getElementById('project-selector').addEventListener('change', switchProject);

  // History handlers
  document.getElementById('clear-history-btn').addEventListener('click', clearHistory);
});

async function loadProjects() {
    const data = await StorageManager.getAll();
    const projects = data.projects || {};
    const activeId = data.activeProjectId || 'default';

    // Populate Dropdown
    const selector = document.getElementById('project-selector');
    selector.innerHTML = '<option value="default">Default Project</option>';

    // Populate List in Projects Tab
    const list = document.getElementById('project-list');
    list.innerHTML = '';

    // Add default project to list too
    // list.innerHTML += `<li><strong>Default Project</strong> <span>(System)</span></li>`;

    Object.values(projects).forEach(p => {
        // Dropdown option
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        if (p.id === activeId) opt.selected = true;
        selector.appendChild(opt);

        // List item
        const li = document.createElement('li');
        const count = Object.keys(p.downloadHistory || {}).length;

        const controls = document.createElement('div');
        controls.className = 'project-item-controls';

        // Rename Btn
        const renameBtn = document.createElement('button');
        renameBtn.textContent = '✏️';
        renameBtn.title = 'Rename';
        renameBtn.className = 'icon-btn';
        renameBtn.onclick = () => renameProject(p.id, p.name);

        // Delete Btn
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑️';
        deleteBtn.title = 'Delete';
        deleteBtn.className = 'icon-btn';
        deleteBtn.onclick = () => deleteProject(p.id);

        controls.appendChild(renameBtn);
        controls.appendChild(deleteBtn);

        li.innerHTML = `
            <div class="project-info">
                <strong>${p.name}</strong><br>
                <span style="font-size: 11px; color: #666;">${count} downloads</span>
            </div>
        `;
        li.appendChild(controls);
        list.appendChild(li);
    });

    if (activeId === 'default') {
        selector.value = 'default';
    } else {
        selector.value = activeId;
    }
}

async function createProject() {
    const nameInput = document.getElementById('new-project-name');
    const name = nameInput.value.trim();
    if (!name) return;

    await StorageManager.createProject(name);
    nameInput.value = '';
    await loadProjects();
}

async function switchProject(e) {
    const id = e.target.value;
    await StorageManager.save({ activeProjectId: id });
    await loadProjects();
}

async function renameProject(id, oldName) {
    const newName = prompt("Enter new project name:", oldName);
    if (newName && newName.trim() !== "") {
        await StorageManager.renameProject(id, newName.trim());
        await loadProjects();
    }
}

async function deleteProject(id) {
    if (confirm("Are you sure you want to delete this project?")) {
        await StorageManager.deleteProject(id);
        await loadProjects();
    }
}

async function checkCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const infoDiv = document.getElementById('current-video-info');
  const btn = document.getElementById('quick-download-btn');

  if (tab && tab.url && (tab.url.includes('youtube.com/watch') || tab.url.includes('youtu.be'))) {
    infoDiv.innerHTML = `<strong>${tab.title.replace(' - YouTube', '')}</strong>`;
    btn.disabled = false;
    btn.onclick = () => {
        // Send message to content script to open modal
        // Alternatively, we could initiate download from here directly if we had the logic in background
        // But content script has the parsed tracks logic.
        // Best UX: Open the modal on the page so user can see it.
        chrome.tabs.sendMessage(tab.id, { action: "openModal" }).catch(() => {
            infoDiv.textContent = "Please refresh the video page to enable the extension.";
        });
        window.close(); // Close popup
    };
  } else {
    infoDiv.textContent = "No YouTube video detected.";
    btn.disabled = true;
  }
}

function scrapeCurrentPage() {
    // Inject script to find all hrefs matching video pattern
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab) return;

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const links = Array.from(document.querySelectorAll('a[href*="/watch?v="]'));
                return links.map(a => a.href).filter((v, i, a) => a.indexOf(v) === i); // Unique
            }
        }, (results) => {
            if (results && results[0] && results[0].result) {
                const urls = results[0].result;
                const textarea = document.getElementById('batch-urls');
                const existing = textarea.value ? textarea.value + '\n' : '';
                textarea.value = existing + urls.join('\n');
            }
        });
    });
}

async function startBatchDownload() {
    const urls = document.getElementById('batch-urls').value.split('\n').filter(u => u.trim());
    if (urls.length === 0) {
        alert("Please enter URLs.");
        return;
    }

    // We should implement the actual batch logic in background.js to persist if popup closes?
    // Or keep it simple for now: popup must stay open.
    // Given the requirement for "Queue Management", it's best handled in Background or persistent storage.
    // For this version, let's implement a simple message to background to start batch.

    chrome.runtime.sendMessage({
        action: 'startBatch',
        urls: urls
    });

    // Reset UI
    document.querySelector('.progress-bar-container').style.display = 'block';
    document.getElementById('batch-progress-bar').style.width = '0%';
    const log = document.getElementById('batch-log');
    log.innerHTML = '';
}

async function loadHistory() {
    const data = await StorageManager.getAll();
    const activeId = data.activeProjectId || 'default';

    let history = {};
    if (activeId !== 'default' && data.projects && data.projects[activeId]) {
        history = data.projects[activeId].downloadHistory || {};
    } else {
        history = data.downloadHistory || {};
    }

    const list = document.getElementById('history-list');
    list.innerHTML = '';

    const entries = Object.entries(history)
        .sort((a, b) => b[1].downloadedAt - a[1].downloadedAt)
        .slice(0, 50);

    if (entries.length === 0) {
        list.innerHTML = '<li style="text-align: center; padding: 20px; color: #999;">No downloads yet</li>';
        return;
    }

    entries.forEach(([videoId, item]) => {
        const li = document.createElement('li');
        li.style.cssText = 'padding: 10px; border-bottom: 1px solid #f0f0f0; font-size: 12px;';

        const date = new Date(item.downloadedAt).toLocaleDateString();
        const time = new Date(item.downloadedAt).toLocaleTimeString();
        const formats = item.formats?.join(', ') || 'txt';
        const summaryBadge = item.hasSummary ? '<span style="background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 5px;">AI</span>' : '';

        li.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <strong style="color: #333;">${item.title || videoId}</strong>
                    ${summaryBadge}
                    <div style="color: #666; font-size: 11px; margin-top: 3px;">
                        <span>${videoId}</span> •
                        <span>${formats}</span> •
                        <span>${item.language || 'en'}</span>
                    </div>
                    <div style="color: #999; font-size: 10px; margin-top: 2px;">
                        ${date} ${time}
                    </div>
                </div>
                <a href="https://youtube.com/watch?v=${videoId}" target="_blank"
                   style="color: #cc0000; text-decoration: none; font-size: 18px; padding: 5px;"
                   title="Open video">▶</a>
            </div>
        `;
        list.appendChild(li);
    });
}

async function clearHistory() {
    if (!confirm('Clear all download history for this project?')) return;

    const data = await StorageManager.getAll();
    const activeId = data.activeProjectId || 'default';

    if (activeId !== 'default' && data.projects && data.projects[activeId]) {
        data.projects[activeId].downloadHistory = {};
        await StorageManager.save({ projects: data.projects });
    } else {
        await StorageManager.save({ downloadHistory: {} });
    }

    await loadHistory();
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'batchProgress') {
        const { total, current, status, videoId, success } = message.data;

        // Update progress bar
        const pct = (current / total) * 100;
        document.getElementById('batch-progress-bar').style.width = `${pct}%`;

        // Add log entry
        const log = document.getElementById('batch-log');
        const li = document.createElement('li');
        const icon = success === true ? '✅' : (success === false ? '❌' : '⏳');
        li.textContent = `${icon} [${current}/${total}] ${videoId}: ${status}`;
        log.prepend(li); // Newest first
    }
});
