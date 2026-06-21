import os
from dotenv import load_dotenv

# Load env variables from .env
load_dotenv()

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "vitalscan-secret-key-2026")
    
    # Use DATABASE_URL from environment (e.g. Neon PostgreSQL on Render)
    # Fallback to local SQLite for development
    db_url = os.environ.get("DATABASE_URL")
    if db_url and db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
        
    SQLALCHEMY_DATABASE_URI = db_url or "sqlite:///vitalscan.db"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
