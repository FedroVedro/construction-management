from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
from .. import crud, models, schemas, database, auth

router = APIRouter()

# Маппинг отделов к типам графиков
DEPARTMENT_SCHEDULE_MAPPING = {
    "Отдел документации": "document",
    "HR отдел": "hr",
    "Отдел закупок": "procurement",
    "Строительный отдел": "construction"
}

def check_department_permission(user: models.User, schedule_type: str):
    """Проверка соответствия отдела пользователя и типа графика"""
    if user.role == "admin":
        return True
    
    if user.role == "director":
        return False  # Директор только просматривает
    
    if user.role == "department_user":
        allowed_type = DEPARTMENT_SCHEDULE_MAPPING.get(user.department)
        if allowed_type != schedule_type:
            raise HTTPException(
                status_code=403, 
                detail=f"Вы можете работать только с графиками типа '{allowed_type}'"
            )
        return True
    
    return False

@router.get("/", response_model=List[schemas.Schedule])
def read_schedules(
    schedule_type: Optional[str] = Query(None),
    city_id: Optional[int] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Для department_user показываем только их тип графиков
    if current_user.role == "department_user":
        allowed_type = DEPARTMENT_SCHEDULE_MAPPING.get(current_user.department)
        if allowed_type:
            schedule_type = allowed_type
    
    schedules = crud.get_schedules(
        db, 
        schedule_type=schedule_type,
        city_id=city_id,
        skip=skip, 
        limit=limit
    )
    return schedules

@router.post("/", response_model=schemas.Schedule)
def create_schedule(
    schedule: schemas.ScheduleCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Проверяем права на создание
    if current_user.role == "director":
        raise HTTPException(status_code=403, detail="Директор может только просматривать графики")
    
    # Проверяем соответствие отдела и типа графика
    if current_user.role == "department_user":
        check_department_permission(current_user, schedule.schedule_type)
    
    return crud.create_schedule(db=db, schedule=schedule, user_id=current_user.id)

@router.put("/{schedule_id}")
def update_schedule(
    schedule_id: int,
    update_data: Dict[str, Any],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Получаем график
    schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="График не найден")
    
    # Проверяем права
    if current_user.role == "director":
        raise HTTPException(status_code=403, detail="Директор может только просматривать графики")
    
    if current_user.role == "department_user":
        check_department_permission(current_user, schedule.schedule_type)
    
    # Обновляем только переданные поля
    for field, value in update_data.items():
        if hasattr(schedule, field):
            # Преобразование дат из строк
            if field in ['planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date']:
                if value:
                    try:
                        value = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    except:
                        pass
                else:
                    value = None
            
            setattr(schedule, field, value)
    
    schedule.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(schedule)
    
    return schedule

@router.delete("/{schedule_id}")
def delete_schedule(
    schedule_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Получаем график
    schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="График не найден")
    
    # Проверяем права
    if current_user.role == "director":
        raise HTTPException(status_code=403, detail="Директор может только просматривать графики")
    
    if current_user.role == "department_user":
        check_department_permission(current_user, schedule.schedule_type)
    
    db.delete(schedule)
    db.commit()
    
    return {"message": "График успешно удален"}

@router.post("/batch", response_model=List[schemas.Schedule])
def create_schedules_batch(
    schedules: List[schemas.ScheduleCreate],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Создание нескольких записей одновременно"""
    if current_user.role == "director":
        raise HTTPException(status_code=403, detail="Директор может только просматривать графики")
    
    created_schedules = []
    for schedule_data in schedules:
        if current_user.role == "department_user":
            check_department_permission(current_user, schedule_data.schedule_type)
        
        schedule = crud.create_schedule(db=db, schedule=schedule_data, user_id=current_user.id)
        created_schedules.append(schedule)
    
    return created_schedules