from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import crud, models, schemas, database, auth

router = APIRouter()

@router.get("/", response_model=List[schemas.User])
def read_users(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.check_admin_role)
):
    users = crud.get_users(db, skip=skip, limit=limit)
    return users

@router.get("/{user_id}", response_model=schemas.User)
def read_user(
    user_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.check_admin_role)
):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

@router.post("/", response_model=schemas.User)
def create_user(
    user: schemas.UserCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.check_admin_role)
):
    # Проверяем, не существует ли уже пользователь с таким username
    db_user = crud.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")
    
    # Проверяем email
    existing_email = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
    
    return crud.create_user(db=db, user=user)

@router.put("/{user_id}", response_model=schemas.User)
def update_user(
    user_id: int,
    user_update: schemas.UserUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.check_admin_role)
):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Проверяем уникальность username если он меняется
    if user_update.username and user_update.username != db_user.username:
        existing = crud.get_user_by_username(db, username=user_update.username)
        if existing:
            raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")
    
    # Проверяем уникальность email если он меняется
    if user_update.email and user_update.email != db_user.email:
        existing = db.query(models.User).filter(models.User.email == user_update.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
    
    # Нельзя редактировать самого себя (менять роль/деактивировать)
    if user_id == current_user.id:
        if user_update.role and user_update.role != current_user.role:
            raise HTTPException(status_code=400, detail="Нельзя изменить свою роль")
        if user_update.is_active is False:
            raise HTTPException(status_code=400, detail="Нельзя деактивировать свой аккаунт")
    
    return crud.update_user(db=db, user_id=user_id, user_update=user_update)

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.check_admin_role)
):
    # Нельзя удалить самого себя
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя удалить свой аккаунт")
    
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Не удаляем, а деактивируем пользователя (для сохранения истории)
    db_user.is_active = False
    db.commit()
    
    return {"message": "Пользователь деактивирован"}

@router.get("/departments/list")
def get_departments(
    current_user: models.User = Depends(auth.check_admin_role)
):
    """Список доступных отделов"""
    return [
        {"id": "hr", "name": "HR", "icon": "👥"},
        {"id": "construction", "name": "Строительство", "icon": "🔨"},
        {"id": "document", "name": "Тех. заказчик", "icon": "📄"},
        {"id": "procurement", "name": "Закупки", "icon": "🛒"},
        {"id": "marketing", "name": "Маркетинг", "icon": "📢"},
        {"id": "project_office", "name": "Проектный офис", "icon": "📁"},
    ]

@router.get("/permissions/list")
def get_available_permissions(
    current_user: models.User = Depends(auth.check_admin_role)
):
    """Список доступных разрешений (страниц)"""
    return [
        {"id": "dashboard", "name": "Панель управления", "icon": "📊"},
        {"id": "hr", "name": "HR-график", "icon": "👥"},
        {"id": "construction", "name": "График строительства", "icon": "🔨"},
        {"id": "document", "name": "График документации", "icon": "📄"},
        {"id": "procurement", "name": "График закупок", "icon": "🛒"},
        {"id": "marketing", "name": "График маркетинга", "icon": "📢"},
        {"id": "project_office", "name": "Проектный офис", "icon": "📁"},
        {"id": "strategic_map", "name": "Мастер-карта", "icon": "🗺️"},
        {"id": "cities", "name": "Объекты строительства", "icon": "🏗️"},
        {"id": "stages", "name": "Этапы строительства", "icon": "📋"},
        {"id": "process", "name": "Процесс управления", "icon": "⚙️"},
        {"id": "dependencies", "name": "Зависимости задач", "icon": "🔗"},
    ]