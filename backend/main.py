from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import CORS_CONFIG
from routes import general, grammar, text_insights

# Initialize FastAPI app
app = FastAPI(
    title="Grammar Bot API",
    version="1.0.0",
    description="AI-powered grammar checking and smart text assistant"
)

# Configure CORS for Chrome extension
app.add_middleware(CORSMiddleware, **CORS_CONFIG)

# Include routers
app.include_router(general.router, tags=["general"])
app.include_router(grammar.router, tags=["grammar"])
app.include_router(text_insights.router, tags=["text-insights"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 