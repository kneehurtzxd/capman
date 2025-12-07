document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save-btn').addEventListener('click', saveOptions);
document.getElementById('toggle-api-key').addEventListener('click', toggleApiKeyVisibility);

async function restoreOptions() {
  await StorageManager.init();
  const data = await StorageManager.getAll();
  const settings = data.settings || StorageManager.defaults.settings;

  document.getElementById('default-format').value = settings.defaultFormat || 'txt';
  document.getElementById('filename-template').value = settings.filenameTemplate || '{date}_{title}_{videoId}.{ext}';

  if (settings.ai) {
    document.getElementById('api-key').value = settings.ai.apiKey || '';
    document.getElementById('api-endpoint').value = settings.ai.apiEndpoint || 'https://api.openai.com/v1/chat/completions';
    document.getElementById('api-model').value = settings.ai.model || 'gpt-4o-mini';
    document.getElementById('system-prompt').value = settings.ai.systemPrompt || 'Summarize this transcript...';
  }
}

async function saveOptions() {
  const settings = {
    defaultFormat: document.getElementById('default-format').value,
    filenameTemplate: document.getElementById('filename-template').value,
    ai: {
      apiKey: document.getElementById('api-key').value,
      apiEndpoint: document.getElementById('api-endpoint').value,
      model: document.getElementById('api-model').value,
      systemPrompt: document.getElementById('system-prompt').value
    }
  };

  // We need to merge with existing settings to keep other fields (like projects if stored there, though projects are sibling)
  // Actually StorageManager.save merges at top level, but for nested object 'settings' we should be careful.
  // StorageManager.defaults.settings has other fields like defaultLanguage.

  const currentData = await StorageManager.getAll();
  const newSettings = { ...currentData.settings, ...settings };

  await StorageManager.save({ settings: newSettings });

  const status = document.getElementById('status-msg');
  status.textContent = 'Options saved.';
  setTimeout(() => {
    status.textContent = '';
  }, 2000);
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('api-key');
  if (input.type === 'password') {
    input.type = 'text';
  } else {
    input.type = 'password';
  }
}
