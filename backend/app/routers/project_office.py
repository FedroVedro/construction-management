from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
from .. import models, schemas, database, auth

router = APIRouter()

STATUS_ALLOWED = ['Отложено', 'В работе', 'Не актуально', 'Выполнено']

@router.get("/", response_model=List[schemas.ProjectOfficeTask])
def read_tasks(
    city_id: int = Query(...),
    skip: int = 0,
    limit: int = 500,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    query = db.query(models.ProjectOfficeTask).filter(models.ProjectOfficeTask.city_id == city_id)
    tasks = query.order_by(models.ProjectOfficeTask.id.asc()).offset(skip).limit(limit).all()
    
    # Подтянуть этап строительства по наименованию работ на основе графиков
    # Линкуем по первому найденному совпадению в schedules (work_name/sections)
    if tasks:
        # Получаем все релевантные графики по городу
        schedules = db.query(models.Schedule).filter(models.Schedule.city_id == city_id).all()
        for t in tasks:
            stage_name = None
            work = (t.work_name or '').strip()
            if work:
                for s in schedules:
                    # Совпадение либо по work_name, либо по sections
                    if (s.work_name and s.work_name == work) or (s.sections and s.sections == work):
                        stage_name = s.construction_stage
                        break
            # Добавляем атрибут динамически для сериализации через from_attributes
            setattr(t, 'construction_stage', stage_name)
    return tasks

@router.post("/", response_model=schemas.ProjectOfficeTask)
def create_task(
    task: schemas.ProjectOfficeTaskCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_task = models.ProjectOfficeTask(**task.model_dump(exclude_unset=True))
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@router.put("/{task_id}", response_model=schemas.ProjectOfficeTask)
def update_task(
    task_id: int,
    update_data: Dict[str, Any],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_task = db.query(models.ProjectOfficeTask).filter(models.ProjectOfficeTask.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Запись не найдена")

    # Валидация статуса
    status_value = update_data.get('status')
    if status_value is not None and status_value not in STATUS_ALLOWED:
        raise HTTPException(status_code=422, detail=f"Недопустимый статус: {status_value}")

    # Преобразование дат из строк (кроме due_date — это текст)
    for field in ['set_date', 'completion_date']:
        if field in update_data:
            value = update_data[field]
            if value in (None, ''):
                update_data[field] = None
            elif isinstance(value, str):
                try:
                    update_data[field] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                except:
                    try:
                        update_data[field] = datetime.strptime(value, '%Y-%m-%d')
                    except:
                        pass

    for k, v in update_data.items():
        if hasattr(db_task, k):
            setattr(db_task, k, v)

    db_task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_task)
    return db_task

@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_task = db.query(models.ProjectOfficeTask).filter(models.ProjectOfficeTask.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    db.delete(db_task)
    db.commit()
    return {"message": "Удалено"}


