from sqlalchemy.orm import Session
from sqlalchemy import or_
from . import models, schemas, auth
from typing import List, Optional

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        role=user.role,
        department=user.department
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_cities(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.City).offset(skip).limit(limit).all()

def get_city(db: Session, city_id: int):
    return db.query(models.City).filter(models.City.id == city_id).first()

def create_city(db: Session, city: schemas.CityCreate):
    db_city = models.City(**city.dict())
    db.add(db_city)
    db.commit()
    db.refresh(db_city)
    return db_city

def update_city(db: Session, city_id: int, city_update: schemas.CityUpdate):
    db_city = db.query(models.City).filter(models.City.id == city_id).first()
    if db_city:
        update_data = city_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_city, field, value)
        db.commit()
        db.refresh(db_city)
    return db_city

def delete_city(db: Session, city_id: int):
    db_city = db.query(models.City).filter(models.City.id == city_id).first()
    if db_city:
        db.delete(db_city)
        db.commit()
        return True
    return False

# Construction Stages CRUD
def get_construction_stages(
    db: Session, 
    skip: int = 0, 
    limit: int = 100,
    active_only: bool = False,
    search: Optional[str] = None
):
    query = db.query(models.ConstructionStage)
    
    if active_only:
        query = query.filter(models.ConstructionStage.is_active == True)
    
    if search:
        query = query.filter(
            or_(
                models.ConstructionStage.name.ilike(f'%{search}%'),
                models.ConstructionStage.description.ilike(f'%{search}%')
            )
        )
    
    return query.order_by(models.ConstructionStage.order_index, models.ConstructionStage.name).offset(skip).limit(limit).all()

def get_construction_stage(db: Session, stage_id: int):
    return db.query(models.ConstructionStage).filter(models.ConstructionStage.id == stage_id).first()

def get_construction_stage_by_name(db: Session, name: str):
    return db.query(models.ConstructionStage).filter(models.ConstructionStage.name == name).first()

def create_construction_stage(db: Session, stage: schemas.ConstructionStageCreate):
    db_stage = models.ConstructionStage(**stage.dict())
    db.add(db_stage)
    db.commit()
    db.refresh(db_stage)
    return db_stage

def update_construction_stage(db: Session, stage_id: int, stage_update: schemas.ConstructionStageUpdate):
    db_stage = db.query(models.ConstructionStage).filter(models.ConstructionStage.id == stage_id).first()
    if db_stage:
        update_data = stage_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_stage, field, value)
        db.commit()
        db.refresh(db_stage)
    return db_stage

def delete_construction_stage(db: Session, stage_id: int):
    db_stage = db.query(models.ConstructionStage).filter(models.ConstructionStage.id == stage_id).first()
    if db_stage:
        # Проверяем, используется ли этап в графиках
        schedules_count = db.query(models.Schedule).filter(models.Schedule.construction_stage_id == stage_id).count()
        if schedules_count > 0:
            # Вместо удаления делаем неактивным
            db_stage.is_active = False
            db.commit()
            return False
        else:
            db.delete(db_stage)
            db.commit()
            return True
    return False

# Schedules CRUD
def get_schedules(
    db: Session, 
    schedule_type: Optional[str] = None,
    city_id: Optional[int] = None,
    user_id: Optional[int] = None,
    skip: int = 0, 
    limit: int = 100
):
    query = db.query(models.Schedule)
    
    if schedule_type:
        query = query.filter(models.Schedule.schedule_type == schedule_type)
    if city_id:
        query = query.filter(models.Schedule.city_id == city_id)
    if user_id:
        query = query.filter(models.Schedule.creator_id == user_id)
        
    return query.offset(skip).limit(limit).all()

def create_schedule(db: Session, schedule: schemas.ScheduleCreate, user_id: int):
    schedule_data = schedule.dict()
    
    # Если передан construction_stage (текст), пытаемся найти или создать этап
    if schedule_data.get('construction_stage') and not schedule_data.get('construction_stage_id'):
        stage = get_construction_stage_by_name(db, schedule_data['construction_stage'])
        if stage:
            schedule_data['construction_stage_id'] = stage.id
        else:
            # Создаем новый этап, если его нет
            new_stage = create_construction_stage(db, schemas.ConstructionStageCreate(
                name=schedule_data['construction_stage'],
                description="Автоматически создан из графика"
            ))
            schedule_data['construction_stage_id'] = new_stage.id
    
    db_schedule = models.Schedule(**schedule_data, creator_id=user_id)
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

def update_schedule(db: Session, schedule_id: int, schedule_update: schemas.ScheduleUpdate):
    db_schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if db_schedule:
        update_data = schedule_update.dict(exclude_unset=True)
        
        # Обработка construction_stage
        if 'construction_stage' in update_data and update_data['construction_stage']:
            stage = get_construction_stage_by_name(db, update_data['construction_stage'])
            if stage:
                update_data['construction_stage_id'] = stage.id
        
        for field, value in update_data.items():
            setattr(db_schedule, field, value)
        db.commit()
        db.refresh(db_schedule)
    return db_schedule

def delete_schedule(db: Session, schedule_id: int):
    db_schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if db_schedule:
        db.delete(db_schedule)
        db.commit()
        return True
    return False