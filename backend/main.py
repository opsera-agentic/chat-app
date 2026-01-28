"""
FastAPI Backend for Chat Application
Provides REST API endpoints with OpenAI ChatGPT integration
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Chat App API",
    description="Backend API for the Chat Application with OpenAI integration",
    version="1.0.0"
)

# Configure CORS - Support environment variable for production
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
allowed_origins = [origin.strip() for origin in cors_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenAI client - lazy initialization to allow app to start without API key
_openai_client = None

def get_openai_client():
    """Get or create OpenAI client (lazy initialization)"""
    global _openai_client
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    if _openai_client is None:
        from openai import OpenAI
        _openai_client = OpenAI(api_key=api_key)
    return _openai_client


class ChatRequest(BaseModel):
    """Request model for chat endpoint"""
    message: str = Field(..., min_length=1, max_length=10000)
    model: str = Field(default="gpt-4-turbo-preview")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Welcome to the Chat App API",
        "status": "healthy",
        "version": "1.0.0"
    }


@app.get("/health")
async def health():
    """Health check endpoint for Kubernetes probes"""
    return {
        "status": "healthy",
        "environment": os.getenv("ENVIRONMENT", "local")
    }


@app.get("/test")
async def test():
    """Test endpoint to verify backend connectivity"""
    return {
        "status": "success",
        "message": "Backend is running correctly!"
    }


@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Chat endpoint that integrates with OpenAI ChatGPT

    Args:
        request: ChatRequest containing message and optional model

    Returns:
        AI response with token usage information
    """
    # Get OpenAI client (lazy initialization)
    client = get_openai_client()
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="OpenAI API key not configured. Please set OPENAI_API_KEY environment variable."
        )

    # Validate message
    if not request.message.strip():
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty"
        )

    try:
        response = client.chat.completions.create(
            model=request.model,
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": request.message}
            ],
            max_tokens=1000,
            temperature=0.7
        )

        return {
            "status": "success",
            "response": response.choices[0].message.content,
            "model": request.model,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            }
        }

    except Exception as e:
        error_message = str(e)
        if "invalid_api_key" in error_message.lower():
            raise HTTPException(status_code=401, detail="Invalid API key")
        elif "rate_limit" in error_message.lower():
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        else:
            raise HTTPException(status_code=500, detail=f"Error: {error_message}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
