from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Sicredi Guardião V2"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False

    # Database
    # SQLite for local dev/tests; PostgreSQL for Neon cloud
    # PostgreSQL: postgresql+psycopg://USER:PASSWORD@HOST/DATABASE?sslmode=require
    DATABASE_URL: str = "sqlite:///./guardiao_v2.db"

    # Security / JWT
    SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours for demo sessions

    # AI Provider
    # Values: "mock" | "gemini" | "groq" | "ollama"
    # Default is "gemini"; use "mock" for tests and offline demo
    AI_PROVIDER: str = "gemini"

    # --------------------------------------------------------------------------
    # Google Gemini (primary provider — free tier)
    # Get a free API key at: https://aistudio.google.com/apikey
    # Model: gemini-2.0-flash-lite is available on the free tier and supports
    #        function calling (tools) required for the agentic fraud workflow.
    # --------------------------------------------------------------------------
    GEMINI_API_KEY: Optional[str] = None  # Set via environment variable only
    GEMINI_MODEL: str = "gemini-2.0-flash-lite"
    GEMINI_TIMEOUT_SECONDS: int = 30
    GEMINI_MAX_OUTPUT_TOKENS: int = 1024
    # Daily quota guard: max AI calls per session to avoid burning free quota
    GEMINI_MAX_CALLS_PER_SESSION: int = 50

    # Groq (optional fallback — kept for compatibility)
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.1-8b-instant"
    GROQ_TIMEOUT_SECONDS: int = 15

    # Ollama (optional local inference — kept for compatibility)
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2:3b"
    OLLAMA_TIMEOUT_SECONDS: int = 60

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
