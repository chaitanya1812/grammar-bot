import json
from fastapi import APIRouter, HTTPException
from models import GrammarCheckRequest, GrammarCheckResponse, Suggestion
from prompts import PROMPTS
from config import get_ai_model

router = APIRouter()


@router.post("/check-grammar", response_model=GrammarCheckResponse)
async def check_grammar(request: GrammarCheckRequest):
    """Check grammar and provide suggestions"""
    try:
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        # Get the appropriate prompt
        prompt_template = PROMPTS.get(request.feature, PROMPTS["grammar_check"])
        prompt = prompt_template.format(text=request.text)

        print("Grammar check request:", request.text)
        
        # Get AI model and call API
        model = get_ai_model()
        response = model.generate_content(prompt)

        print("Grammar check response:", response.text)
        
        if not response.text:
            raise HTTPException(status_code=500, detail="Failed to get response from AI model")
        
        # Parse the response (assuming it returns JSON)
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
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing grammar check request: {str(e)}") 