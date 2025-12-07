/**
 * Storage Manager Library
 * Handles data persistence for projects, settings, and download history.
 */

const StorageManager = {

  // Default structure
  defaults: {
    settings: {
      defaultFormat: 'txt',
      defaultLanguage: 'en',
      includeTimestamps: true,
      filenameTemplate: '{date}_{title}_{videoId}.{ext}',
      ai: {
          apiKey: '',
          apiEndpoint: 'https://api.openai.com/v1/chat/completions',
          model: 'gpt-4o-mini',
          systemPrompt: 'Summarize this transcript...'
      }
    },
    projects: {}, // map of uuid -> project object
    activeProjectId: 'default',
    // Global history if no project selected or for "default" project logic
    downloadHistory: {}
  },

  async init() {
    const data = await this.getAll();
    if (!data.settings) {
      await this.save(this.defaults);
    }
  },

  /**
   * Retrieves all data from storage.
   */
  async getAll() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (result) => {
        resolve(result);
      });
    });
  },

  /**
   * Saves data to storage (merges with existing).
   */
  async save(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, () => {
        resolve();
      });
    });
  },

  /**
   * Gets the active project.
   */
  async getActiveProject() {
    const data = await this.getAll();
    const pid = data.activeProjectId;
    if (pid === 'default') return null;
    return data.projects[pid];
  },

  /**
   * Creates a new project.
   */
  async createProject(name) {
    const data = await this.getAll();
    const id = crypto.randomUUID();
    const project = {
        id,
        name,
        created: Date.now(),
        settings: { ...data.settings }, // Copy global settings as start
        downloadHistory: {}
    };

    if (!data.projects) data.projects = {};
    data.projects[id] = project;
    data.activeProjectId = id;

    await this.save({ projects: data.projects, activeProjectId: id });
    return project;
  },

  /**
   * Renames a project.
   */
  async renameProject(id, newName) {
    const data = await this.getAll();
    if (data.projects && data.projects[id]) {
      data.projects[id].name = newName;
      await this.save({ projects: data.projects });
    }
  },

  /**
   * Deletes a project.
   */
  async deleteProject(id) {
    const data = await this.getAll();
    if (data.projects && data.projects[id]) {
      delete data.projects[id];
      // Reset active if we deleted the active one
      if (data.activeProjectId === id) {
        await this.save({ projects: data.projects, activeProjectId: 'default' });
      } else {
        await this.save({ projects: data.projects });
      }
    }
  },

  /**
   * Adds an entry to download history.
   */
  async addHistoryItem(videoId, item) {
    const data = await this.getAll();
    const pid = data.activeProjectId;

    if (pid !== 'default' && data.projects && data.projects[pid]) {
       // Add to project history
       data.projects[pid].downloadHistory[videoId] = item;
       await this.save({ projects: data.projects });
    } else {
       // Add to global history
       const history = data.downloadHistory || {};
       history[videoId] = item;
       await this.save({ downloadHistory: history });
    }
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
} else {
  (typeof globalThis !== 'undefined' ? globalThis : window).StorageManager = StorageManager;
}
