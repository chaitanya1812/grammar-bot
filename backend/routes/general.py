from fastapi import APIRouter, HTTPException
import google.generativeai as genai
from models import FeaturesResponse
from config import GEMINI_MODEL_NAME

router = APIRouter()


@router.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Grammar Bot API is running"}


@router.get("/features", response_model=FeaturesResponse)
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
            "id": "text_insights",
            "name": "Smart Text Assistant",
            "description": "Explain, summarize, or perform custom actions on selected text",
            "icon": "🧠",
            "enabled": True,
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


@router.get("/models")
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