# Grammar Bot - AI-Powered Grammar Assistant

An intelligent Chrome extension that provides real-time grammar checking, spelling correction, and writing improvements using Google's Gemini AI model.

## Features

### ✅ Currently Available
- **Grammar Check**: Detect and fix grammar errors with AI-powered suggestions
- **Real-time Analysis**: Get instant feedback on selected text
- **Smart Popup Interface**: Grammarly-like experience with intuitive UI
- **Apply Suggestions**: One-click fix for individual or all suggestions

### 🚧 Coming Soon
- **Spell Check**: Advanced spelling correction
- **Sentence Improvement**: Enhance clarity and readability
- **Tone Adjustment**: Modify text tone (professional, casual, etc.)

## Architecture

```
grammar-bot/
├── backend/           # FastAPI Python server
│   ├── main.py       # Main application
│   ├── requirements.txt
│   └── env.example   # Environment variables template
├── frontend/         # Chrome extension
│   ├── manifest.json # Extension configuration
│   ├── content.js    # Content script for text selection
│   ├── background.js # Service worker
│   ├── popup.html    # Extension popup
│   ├── popup.css     # Popup styles
│   ├── popup.js      # Popup functionality
│   └── styles.css    # Content script styles
└── README.md
```

## Prerequisites

- Python 3.8+
- Google Chrome browser
- Gemini API key (from Google AI Studio)

## Setup Instructions

### 1. Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables:**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

5. **Start the server:**
   ```bash
   python3 main.py
   ```
   
   The backend will be running at `http://localhost:8000`

### 2. Frontend Setup (Chrome Extension)

1. **Open Chrome and navigate to extensions:**
   ```
   chrome://extensions/
   ```

2. **Enable Developer mode** (toggle in top-right corner)

3. **Load unpacked extension:**
   - Click "Load unpacked"
   - Select the `frontend` folder from this project

4. **Verify installation:**
   - You should see the Grammar Bot extension icon in your browser toolbar
   - Click the icon to open the popup and check backend connection status

## Usage

### Basic Grammar Check

1. **Select text** on any webpage by highlighting it with your mouse
2. **Grammar Bot popup** will automatically appear near your selection
3. **Click "Grammar Check"** to analyze the selected text
4. **Review suggestions** - each will show:
   - Original text with error highlighted
   - Suggested correction
   - Explanation of the issue
   - Confidence score
5. **Apply fixes:**
   - Click "Apply Fix" for individual suggestions
   - Click "Apply All Fixes" to apply all suggestions at once

### Extension Popup

Click the Grammar Bot icon in your browser toolbar to:
- View connection status with the backend
- See available features
- Adjust settings:
  - Auto-check on text selection
  - Show success notifications

## API Endpoints

### Backend API Reference

- `GET /` - Health check
- `GET /features` - Get available features list
- `POST /check-grammar` - Submit text for grammar analysis

Example request:
```json
{
  "text": "This are a sentence with grammar error.",
  "feature": "grammar_check"
}
```

Example response:
```json
{
  "suggestions": [
    {
      "original_text": "This are",
      "corrected_text": "This is",
      "explanation": "Subject-verb agreement error",
      "confidence": 0.95
    }
  ],
  "has_errors": true
}
```

## Development

### Backend Development

1. **Code structure:**
   - `main.py` - FastAPI application with routes and AI integration
   - Prompts are hardcoded for different features
   - CORS enabled for Chrome extension

2. **Adding new features:**
   - Add new prompt templates in `PROMPTS` dictionary
   - Update the `/features` endpoint
   - Enable in frontend feature list

3. **Testing:**
   ```bash
   # Start server in development mode
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

### Frontend Development

1. **Key files:**
   - `content.js` - Main logic for text selection and popup
   - `styles.css` - Popup and UI styling
   - `popup.js` - Extension popup functionality

2. **Testing changes:**
   - Make your changes
   - Go to `chrome://extensions/`
   - Click the refresh icon on Grammar Bot extension
   - Test on any webpage

3. **Debugging:**
   - Open Chrome DevTools
   - Check Console for content script logs
   - Use Extension popup DevTools for popup debugging

## Configuration

### Environment Variables

- `GEMINI_API_KEY` - Your Google Gemini API key (required)

### Chrome Extension Permissions

- `activeTab` - Access to current tab content
- `storage` - Save user settings
- `http://localhost:8000/*` - Communication with local backend

## Troubleshooting

### Common Issues

1. **"Backend is offline" error:**
   - Ensure the Python backend is running on port 8000
   - Check if you have the correct Gemini API key in `.env`
   - Verify no firewall blocking localhost:8000

2. **Extension not working:**
   - Refresh the extension in `chrome://extensions/`
   - Check browser console for JavaScript errors
   - Ensure you've selected text properly (minimum 3 characters)

3. **Grammar check not working:**
   - Verify Gemini API key is valid and has quota
   - Check backend logs for API errors
   - Ensure internet connection is stable

### Logs

- **Backend logs:** Check terminal where you ran `python3 main.py`
- **Frontend logs:** Open Chrome DevTools → Console tab
- **Extension logs:** `chrome://extensions/` → Details → Inspect views

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Roadmap

- [ ] Add more language support
- [ ] Implement offline mode with local models
- [ ] Add writing analytics and insights
- [ ] Support for more AI providers
- [ ] Mobile app version
- [ ] Integration with popular writing platforms

## Support

For issues, feature requests, or questions:
1. Check existing issues in the repository
2. Create a new issue with detailed description
3. Include browser version, OS, and error logs

---

**Note**: This project requires a valid Gemini API key. Sign up at [Google AI Studio](https://makersuite.google.com/) to get your free API key.
