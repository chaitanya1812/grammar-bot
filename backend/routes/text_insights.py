from fastapi import APIRouter, HTTPException
from models import TextInsightRequest, TextInsightResponse
from prompts import PROMPTS
from config import get_ai_model

router = APIRouter()


@router.post("/text-insights", response_model=TextInsightResponse)
async def get_text_insights(request: TextInsightRequest):
    """Smart Text Assistant - Explain, Summarize, or Custom actions on selected text"""
    try:
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        # Validate action
        valid_actions = ["explain", "summarize", "custom"]
        if request.action not in valid_actions:
            raise HTTPException(status_code=400, detail=f"Invalid action. Must be one of: {valid_actions}")
        
        # For custom action, custom_prompt is required
        if request.action == "custom" and not request.custom_prompt:
            raise HTTPException(status_code=400, detail="custom_prompt is required when action is 'custom'")
        
        # Get the appropriate prompt
        prompt_template = PROMPTS.get(request.action)
        if not prompt_template:
            raise HTTPException(status_code=400, detail=f"No prompt found for action: {request.action}")
        
        # Format the prompt
        if request.action == "custom":
            prompt = prompt_template.format(text=request.text, custom_prompt=request.custom_prompt)
        else:
            prompt = prompt_template.format(text=request.text)

        print(f"Text Insights request - Action: {request.action}, Text: {request.text[:100]}...")
        
        # Get AI model and call API
        model = get_ai_model()
        response = model.generate_content(prompt)

        print(f"Text Insights response: {response.text[:200]}...")
        
        if not response.text:
            raise HTTPException(status_code=500, detail="Failed to get response from AI model")
        
        return TextInsightResponse(
            original_text=request.text,
            action=request.action,
            result=response.text.strip(),
            custom_prompt=request.custom_prompt if request.action == "custom" else None
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing text insights request: {str(e)}") 