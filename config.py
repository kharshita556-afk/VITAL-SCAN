import os
from dotenv import load_dotenv

# Load env variables from .env
load_dotenv()

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "vitalscan-secret-key-2026")
    SQLALCHEMY_DATABASE_URI = "sqlite:///vitalscan.db"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
