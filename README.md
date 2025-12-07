# YouTube Transcript Downloader

A feature-rich browser extension for downloading YouTube video transcripts in multiple formats with AI-powered summarization capabilities.

## Features

### Core Functionality
- **Single Video Download**: Download transcripts from the current YouTube video with one click
- **Batch Processing**: Download transcripts from multiple videos simultaneously
- **Multiple Format Support**: Export transcripts in TXT, MD, JSON, CSV, SRT, and VTT formats
- **AI Summarization**: Generate concise summaries using OpenAI or compatible APIs
- **Project Management**: Organize downloads into separate projects
- **Download History**: Track all downloaded transcripts with searchable history
- **Auto-Detection**: Automatically detects YouTube videos and shows download button

### Advanced Features
- **Smart Language Selection**: Automatically selects your preferred language or falls back to English
- **Rate Limiting**: Built-in throttling to prevent API abuse
- **Retry Logic**: Exponential backoff for failed requests
- **Progress Tracking**: Real-time progress indicators for batch downloads
- **Error Handling**: Comprehensive error messages and recovery
- **Filename Templates**: Customizable filename patterns with variables
- **Page Scraping**: Extract all video links from YouTube playlists and channel pages
- **Notifications**: Desktop notifications for download completion and errors

## Installation

### Chrome/Edge
1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The extension icon will appear in your toolbar

### Firefox
1. Clone or download this repository
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select any file from the extension directory
5. The extension will be loaded temporarily (persists until browser restart)

## Usage

### Quick Download
1. Navigate to any YouTube video
2. Click the red download button in the bottom-right corner
3. Select your preferred language and formats
4. Optionally enable AI summarization
5. Click "Download"

### Batch Download
1. Click the extension icon in your toolbar
2. Navigate to the "Batch" tab
3. Enter video URLs (one per line) or use "Scrape Current Page" to extract all links
4. Click "Start Batch Download"
5. Monitor progress in the real-time log

### Using Projects
1. Open the extension popup
2. Go to the "Projects" tab
3. Create a new project with a descriptive name
4. Select the project from the dropdown in the header
5. All downloads will be associated with the active project

### Viewing History
1. Open the extension popup
2. Click the "History" tab
3. View all downloaded transcripts with metadata
4. Click the play button to open the video on YouTube
5. Use "Clear History" to remove all entries for the current project

## Configuration

### Settings Page
Access the settings page by clicking "Settings" in the extension popup or right-clicking the extension icon and selecting "Options".

#### General Settings
- **Default Format**: Choose the default export format
- **Filename Template**: Customize filename patterns using variables:
  - `{date}` - Current date (YYYY-MM-DD)
  - `{title}` - Video title (sanitized)
  - `{videoId}` - YouTube video ID
  - `{channel}` - Channel name
  - `{lang}` - Language code
  - `{ext}` - File extension

#### AI Configuration
- **API Key**: Your OpenAI API key (or compatible service)
- **API Endpoint**: Custom API endpoint (default: OpenAI)
- **Model**: AI model to use (default: gpt-4o-mini)
- **System Prompt**: Customize the summarization instructions
  - Use template variables like `{title}`, `{videoId}`, `{language}`
  - Example: `Summarize this transcript from "{title}" (ID: {videoId})`

### Example Configuration

```
Filename Template: {date}_{title}_{videoId}.{ext}
Result: 2025-12-07_How_to_Code_dQw4w9WgXcQ.txt

System Prompt: Provide a concise summary of "{title}" highlighting key points
```

## Architecture

### File Structure
```
/
├── manifest.json           # Extension configuration
├── background.js           # Service worker for downloads
├── content-script.js       # YouTube page integration
├── content-styles.css      # Injected UI styles
├── popup/                  # Extension popup UI
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── options/                # Settings page
│   ├── options.html
│   ├── options.js
│   └── options.css
├── lib/                    # Core libraries
│   ├── ai-service.js       # AI summarization
│   ├── format-converter.js # Format transformations
│   ├── rate-limiter.js     # Request throttling
│   ├── sanitize.js         # Filename sanitization
│   ├── storage-manager.js  # Data persistence
│   └── transcript-parser.js # YouTube API parsing
├── icons/                  # Extension icons
└── tests/                  # Unit tests
```

### Key Components

#### Transcript Parser
- Extracts caption tracks from YouTube's player response
- Fetches and parses timedtext XML format
- Supports multiple languages and auto-generated captions

#### Format Converter
- Transforms transcript segments into various formats
- Preserves timestamps and metadata
- Handles HTML entity decoding

#### Rate Limiter
- Implements concurrent request limiting
- Exponential backoff for retries
- Handles 429 (Too Many Requests) errors

#### Storage Manager
- Manages extension settings and state
- Handles project-based organization
- Tracks download history

#### AI Service
- Integrates with OpenAI-compatible APIs
- Supports custom prompts with template variables
- Error handling and validation

## API Integration

### Using OpenAI
1. Sign up at https://platform.openai.com
2. Generate an API key
3. Enter the key in Settings
4. Default endpoint works automatically

### Using Custom APIs
Any OpenAI-compatible API can be used:
1. Set the API endpoint in Settings
2. Configure authentication if needed
3. Adjust the model name to match your service

Example for LocalAI:
```
Endpoint: http://localhost:8080/v1/chat/completions
Model: gpt-4
```

## Development

### Running Tests
```bash
npm install
npm test
```

### Test Coverage
- Sanitization and filename generation
- Format conversion (all formats)
- Transcript parsing (XML, HTML entities)
- AI service (template variables, error handling)

### Adding New Formats
1. Add converter function in `lib/format-converter.js`
2. Update format selection UI in `content-script.js`
3. Add format option in settings
4. Create tests for the new format

## Troubleshooting

### Extension Not Loading
- Ensure all files are present
- Check browser console for errors
- Verify manifest.json syntax

### No Captions Available
- Video must have captions enabled
- Auto-generated captions count
- Some videos have region-restricted captions

### Batch Download Failures
- Check rate limiting (default: 2 concurrent, 1.5s delay)
- Verify URLs are valid YouTube links
- Some videos may be private or deleted

### AI Summarization Errors
- Verify API key is correct
- Check API endpoint is reachable
- Ensure sufficient API credits
- Review system prompt for syntax errors

### Download Not Starting
- Check browser download permissions
- Verify popup blocker settings
- Look for notifications about errors

## Privacy & Security

- No data is collected or transmitted to external servers
- API keys are stored locally in browser storage
- All processing happens client-side
- AI summarization only sends transcript text to your configured API

## Permissions

- `downloads`: Required to save transcript files
- `storage`: Required for settings and history
- `notifications`: Required for download notifications
- `youtube.com`: Required to access video pages and transcripts

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

ISC License - See LICENSE file for details

## Support

For issues, questions, or feature requests, please visit the GitHub repository.

## Changelog

### Version 1.0.0
- Initial release
- Single and batch transcript downloads
- Multiple format support (TXT, MD, JSON, CSV, SRT, VTT)
- AI summarization with OpenAI integration
- Project management
- Download history tracking
- Customizable filename templates
- Rate limiting and retry logic
- Comprehensive error handling
- Desktop notifications
- Page scraping for batch URLs
