# Smart Text Assistant API Documentation

## Overview

The **Smart Text Assistant** is a new feature that allows users to:
- **Explain** difficult text, jargon, or complex sentences
- **Summarize** long text to ~10% of its original length
- Perform **custom actions** with user-defined prompts

This feature is perfect for when users are reading articles, PDFs, or any text content and need quick assistance understanding or processing the text.

## API Endpoint

### POST `/text-insights`

Processes selected text with the specified action.

**Request Body:**
```json
{
    "text": "The text you want to analyze",
    "action": "explain|summarize|custom",
    "custom_prompt": "Required only when action is 'custom'"
}
```

**Response:**
```json
{
    "original_text": "The original text that was analyzed",
    "action": "The action that was performed",
    "result": "The AI's response/analysis",
    "custom_prompt": "The custom prompt (only for custom actions)"
}
```

## Available Actions

### 1. Explain 💡
- **Purpose**: Understand difficult words, jargon, technical terms, or complex sentences
- **Best for**: Academic papers, technical documentation, legal text, medical content
- **Example**: Explaining machine learning terminology or complex concepts

### 2. Summarize 📋
- **Purpose**: Get a concise summary of long text (~10% of original length)
- **Best for**: Long articles, research papers, lengthy reports
- **Example**: Summarizing a 1000-word article into 100 words

### 3. Custom Action ✏️
- **Purpose**: Perform any custom analysis or task on the selected text
- **Best for**: Specific use cases like translation, tone analysis, fact-checking, etc.
- **Example**: "Translate this to Spanish" or "What are the key arguments in this text?"

## Usage Examples

### 1. Explain Technical Jargon
```bash
curl -X POST "http://localhost:8000/text-insights" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "The algorithm leverages machine learning paradigms to optimize computational complexity.",
    "action": "explain"
  }'
```

### 2. Summarize Long Text
```bash
curl -X POST "http://localhost:8000/text-insights" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Long article text here...",
    "action": "summarize"
  }'
```

### 3. Custom Action
```bash
curl -X POST "http://localhost:8000/text-insights" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "The quick brown fox jumps over the lazy dog.",
    "action": "custom",
    "custom_prompt": "What makes this sentence unique?"
  }'
```

## Testing

Run the test script to see all actions in action:

```bash
cd backend
python test_text_insights.py
```

## Integration with Frontend

The feature is automatically included in the `/features` endpoint:

```json
{
  "id": "text_insights",
  "name": "Smart Text Assistant",
  "description": "Explain, summarize, or perform custom actions on selected text",
  "icon": "🧠",
  "enabled": true,
  "actions": [
    {
      "id": "explain",
      "name": "Explain",
      "description": "Understand difficult words, jargon, or sentences",
      "icon": "💡"
    },
    {
      "id": "summarize",
      "name": "Summarize", 
      "description": "Get a concise summary (~10% of original length)",
      "icon": "📋"
    },
    {
      "id": "custom",
      "name": "Custom Action",
      "description": "Write your own prompt for custom text analysis",
      "icon": "✏️"
    }
  ]
}
```

## Error Handling

The API includes comprehensive error handling:
- **400**: Empty text, invalid action, missing custom_prompt for custom actions
- **500**: AI model errors or internal server errors

## Next Steps for Frontend Integration

1. **Text Selection**: Implement text selection detection on web pages
2. **Context Menu**: Show Smart Text Assistant options when text is selected
3. **Popup Interface**: Create UI for the three actions with input field for custom prompts
4. **Results Display**: Show the AI's response in a clean, readable format
5. **Loading States**: Handle async API calls with proper loading indicators 