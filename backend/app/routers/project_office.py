from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
from .. import models, schemas, database, auth

router = APIRouter()

STATUS_ALLOWED = ['Отложено', 'В работе', 'Не актуально', 'Выполнено']


def find_construction_stage(db: Session, city_id: int, work_name: str) -> str:
    """Поиск этапа строительства по наименованию работ в графиках"""
    if not work_name or not work_name.strip():
        return None
    
    work = work_name.strip()
    schedules = db.query(models.Schedule).filter(models.Schedule.city_id == city_id).all()
    
    for s in schedules:
        # Совпадение либо по work_name, либо по sections
        if (s.work_name and s.work_name.strip() == work) or (s.sections and s.sections.strip() == work):
            return s.construction_stage
    
    return None


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
    
    # Если у задачи нет сохранённого этапа строительства, пытаемся подтянуть из графиков
    if tasks:
        schedules = db.query(models.Schedule).filter(models.Schedule.city_id == city_id).all()
        
        for t in tasks:
            # Если этап уже есть - оставляем
            if t.construction_stage:
                continue
            
            # Пробуем найти по work_name
            work = (t.work_name or '').strip()
            if work:
                for s in schedules:
                    if (s.work_name and s.work_name.strip() == work) or (s.sections and s.sections.strip() == work):
                        t.construction_stage = s.construction_stage
                        break
    
    return tasks


@router.post("/", response_model=schemas.ProjectOfficeTask)
def create_task(
    task: schemas.ProjectOfficeTaskCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    task_data = task.model_dump(exclude_unset=True)
    
    # Если construction_stage не указан, но есть work_name - пытаемся найти
    if not task_data.get('construction_stage') and task_data.get('work_name'):
        found_stage = find_construction_stage(db, task_data['city_id'], task_data['work_name'])
        if found_stage:
            task_data['construction_stage'] = found_stage
    
    db_task = models.ProjectOfficeTask(**task_data)
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

    # Валидация статуса (null/пустая строка - очистка статуса, иначе проверяем допустимые значения)
    if 'status' in update_data:
        status_value = update_data.get('status')
        if status_value is None or status_value == '':
            update_data['status'] = None  # Очистка статуса
        elif status_value not in STATUS_ALLOWED:
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

    # Если обновляется work_name и нет явного construction_stage, пытаемся найти
    if 'work_name' in update_data and 'construction_stage' not in update_data:
        work_name = update_data.get('work_name')
        if work_name:
            found_stage = find_construction_stage(db, db_task.city_id, work_name)
            if found_stage:
                update_data['construction_stage'] = found_stage

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
