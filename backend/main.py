import os
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="Grammar Bot API", version="1.0.0")

# Configure CORS for Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, be more specific
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is required")

# Model name - default to the current free tier model
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-flash")

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel(GEMINI_MODEL_NAME)

# Request/Response models
class GrammarCheckRequest(BaseModel):
    text: str
    feature: str = "grammar_check"  # Future: spell_check, improve_sentence, change_tone

class Suggestion(BaseModel):
    original_text: str
    corrected_text: str
    explanation: str
    confidence: float

class GrammarCheckResponse(BaseModel):
    suggestions: List[Suggestion]
    has_errors: bool

class FeaturesResponse(BaseModel):
    features: List[dict]

# Hardcoded prompts for different features
PROMPTS = {
    "grammar_check": """
    You are a professional grammar and spelling checker. Analyze the following text and provide corrections.
    
    Text: "{text}"
    
    Please respond in the following JSON format:
    {{
        "suggestions": [
            {{
                "original_text": "exact portion that needs correction",
                "corrected_text": "corrected version",
                "explanation": "brief explanation of the error",
                "confidence": 0.95
            }}
        ],
        "has_errors": true/false
    }}
    
    IMPORTANT RULES:
    1. Only suggest corrections for actual grammar, spelling, case or punctuation errors
    2. If the text is already correct, return "has_errors": false with an empty suggestions array
    3. Keep explanations concise and helpful
    4. CRITICAL: When correcting punctuation, be precise and do not add redundant punctuation and NEVER remove all punctuation unless it's truly wrong.
    5. Focus on fixing the actual error, preserve correct punctuation
    6. When in doubt, preserve existing punctuation rather than removing it
    7. IMPORTANT: The "corrected_text" will be used EXACTLY to replace the "original_text" in the user's document. Make sure "corrected_text" contains exactly what should appear in the final text, including all necessary punctuation.
    8. If the change is small just try to keep the necessary word(s) which needs to be changed. for example if only one word is wrong, then just give the correct word. If the change is to add a punctuation, then give it with the last word as needed.
    9. When there is no lack of context for a sentence, then don't return any suggestion for that.
    """,
    
    "spell_check": """
    You are a spell checker. Focus only on spelling errors in the following text:
    
    Text: "{text}"
    
    Respond in JSON format with spelling corrections only.
    """,
    
    "improve_sentence": """
    You are a writing assistant. Improve the clarity and flow of this sentence while maintaining its original meaning:
    
    Text: "{text}"
    
    Provide an improved version with explanation.
    """,
    
    "change_tone": """
    You are a tone adjustment assistant. Modify the tone of this text to be more professional:
    
    Text: "{text}"
    
    Provide the text with adjusted tone.
    """
}

@app.get("/")
async def root():
    return {"message": "Grammar Bot API is running"}

@app.get("/features", response_model=FeaturesResponse)
async def get_features():
    """Get available features for the grammar bot"""
    features = [
        {
            "id": "grammar_check",
            "name": "Grammar Check",
            "description": "Check for grammar and spelling errors",
            "icon": "✓",
            "enabled": True
        },
        {
            "id": "spell_check", 
            "name": "Spell Check",
            "description": "Check for spelling errors only",
            "icon": "📝",
            "enabled": False  # Will enable later
        },
        {
            "id": "improve_sentence",
            "name": "Improve Sentence", 
            "description": "Enhance sentence clarity and flow",
            "icon": "✨",
            "enabled": False  # Will enable later
        },
        {
            "id": "change_tone",
            "name": "Change Tone",
            "description": "Adjust the tone of your text",
            "icon": "🎭",
            "enabled": False  # Will enable later
        }
    ]
    return FeaturesResponse(features=features)

@app.post("/check-grammar", response_model=GrammarCheckResponse)
async def check_grammar(request: GrammarCheckRequest):
    """Check grammar and provide suggestions"""
    try:
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        # Get the appropriate prompt
        prompt_template = PROMPTS.get(request.feature, PROMPTS["grammar_check"])
        prompt = prompt_template.format(text=request.text)

        print("req : ", request.text)
        
        # Call Gemini API
        response = model.generate_content(prompt)

        print("response : ", response.text)
        
        if not response.text:
            raise HTTPException(status_code=500, detail="Failed to get response from AI model")
        
        # Parse the response (assuming it returns JSON)
        import json
        try:
            # Clean the response text to extract JSON
            response_text = response.text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:-3]
            elif response_text.startswith("```"):
                response_text = response_text[3:-3]
            
            result = json.loads(response_text)
            
            # Convert to our response model
            suggestions = []
            for suggestion in result.get("suggestions", []):
                suggestions.append(Suggestion(
                    original_text=suggestion["original_text"],
                    corrected_text=suggestion["corrected_text"],
                    explanation=suggestion["explanation"],
                    confidence=suggestion.get("confidence", 0.9)
                ))
            
            return GrammarCheckResponse(
                suggestions=suggestions,
                has_errors=result.get("has_errors", False)
            )
            
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            return GrammarCheckResponse(
                suggestions=[],
                has_errors=False
            )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")

@app.get("/models")
async def list_models():
    """Get list of available Gemini models"""
    try:
        models = genai.list_models()
        available_models = []
        
        for model in models:
            if 'generateContent' in model.supported_generation_methods:
                available_models.append({
                    "name": model.name,
                    "display_name": model.display_name,
                    "description": model.description,
                    "version": model.version,
                    "input_token_limit": model.input_token_limit,
                    "output_token_limit": model.output_token_limit
                })
        
        return {
            "models": available_models,
            "current_model": GEMINI_MODEL_NAME,
            "count": len(available_models)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing models: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 