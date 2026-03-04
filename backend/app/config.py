import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here-change-in-production")
    ALGORITHM = "HS256"
    # Срок действия токена в JWT (для cookie — фактически Max-Age)
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
    # httpOnly cookie: сессия на 1 год, пользователь не разлогинивается
    SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "session_token")
    SESSION_COOKIE_MAX_AGE = int(os.getenv("SESSION_COOKIE_MAX_AGE", "31536000"))  # 1 год в секундах
    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"
    DATABASE_URL = "sqlite:///./database.db"
    
settings = Settings()