from sqlalchemy.orm import Session
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
    db_schedule = models.Schedule(**schedule.dict(), creator_id=user_id)
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

def update_schedule(db: Session, schedule_id: int, schedule_update: schemas.ScheduleUpdate):
    db_schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if db_schedule:
        update_data = schedule_update.dict(exclude_unset=True)
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