import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is required")

# Model name - default to the current free tier model
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-flash")

# Configure Gemini API
genai.configure(api_key=GEMINI_API_KEY)

# Initialize the model
def get_ai_model():
    """Get the configured AI model instance"""
    return genai.GenerativeModel(GEMINI_MODEL_NAME)

# CORS configuration
CORS_CONFIG = {
    "allow_origins": ["*"],  # In production, be more specific
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
} 