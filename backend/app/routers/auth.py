from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from .. import schemas, models, database, auth, crud
from ..config import settings
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


def _make_login_response(access_token: str, user: models.User):
    """Формирует ответ с httpOnly cookie — сессия сохраняется (по сути без разлогина)."""
    content = {
        "access_token": access_token,
        "token_type": "bearer",
        "user": jsonable_encoder(user)
    }
    response = JSONResponse(content=content)
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=access_token,
        max_age=settings.SESSION_COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=settings.SESSION_COOKIE_SECURE,
        path="/",
    )
    return response


@router.post("/login-json")
def login_json(credentials: schemas.UserLogin, db: Session = Depends(database.get_db)):
    """Логин через JSON — для SPA и кросс-доменных запросов."""
    username = credentials.username
    password = credentials.password
    
    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and password are required",
        )
    
    user = crud.get_user_by_username(db, username=username)
    if not user or not auth.verify_password(password, user.hashed_password):
        logger.warning(f"Failed JSON login attempt for user: {username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    
    # Токен живёт столько же, сколько cookie — сессия без разлогина
    access_token_expires = timedelta(seconds=settings.SESSION_COOKIE_MAX_AGE)
    access_token = auth.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    logger.info(f"Successful JSON login for user: {username}")
    return _make_login_response(access_token, user)


@router.post("/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = crud.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    return crud.create_user(db=db, user=user)


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = crud.get_user_by_username(db, username=form_data.username)
    if not user:
        logger.warning(f"Login attempt for non-existent user: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not auth.verify_password(form_data.password, user.hashed_password):
        logger.warning(f"Failed login attempt for user: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Токен живёт столько же, сколько cookie — сессия без разлогина
    access_token_expires = timedelta(seconds=settings.SESSION_COOKIE_MAX_AGE)
    access_token = auth.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    logger.info(f"Successful login for user: {form_data.username}")
    return _make_login_response(access_token, user)


@router.post("/logout")
def logout():
    """Сбрасывает cookie сессии — выход из системы."""
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie(key=settings.SESSION_COOKIE_NAME, path="/")
    return response


@router.get("/me", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user