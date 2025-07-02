from typing import List, Optional
from pydantic import BaseModel


# Grammar Check Models
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


# Smart Text Assistant Models
class TextInsightRequest(BaseModel):
    text: str
    action: str  # "explain", "summarize", "custom"
    custom_prompt: Optional[str] = None  # Required when action is "custom"


class TextInsightResponse(BaseModel):
    original_text: str
    action: str
    result: str
    custom_prompt: Optional[str] = None


# General Models
class FeaturesResponse(BaseModel):
    features: List[dict] 