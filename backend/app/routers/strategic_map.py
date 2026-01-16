from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime

from ..database import get_db
from ..models import StrategicMapProject, StrategicMapMilestone, City, User
from ..schemas import (
    StrategicMapProject as StrategicMapProjectSchema,
    StrategicMapProjectCreate,
    StrategicMapProjectUpdate,
    StrategicMapMilestone as StrategicMapMilestoneSchema,
    StrategicMapMilestoneCreate,
    StrategicMapMilestoneUpdate,
    StrategicMapBulkUpdate
)
from ..auth import get_current_user

router = APIRouter(prefix="/strategic-map", tags=["strategic-map"])


@router.get("/projects", response_model=List[StrategicMapProjectSchema])
def get_projects(
    city_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить все проекты мастер-карты"""
    try:
        from sqlalchemy.orm import joinedload, selectinload
        
        query = db.query(StrategicMapProject).options(
            selectinload(StrategicMapProject.milestones),
            selectinload(StrategicMapProject.children),
            joinedload(StrategicMapProject.city)
        )
        if city_id:
            query = query.filter(StrategicMapProject.city_id == city_id)
        
        # Получаем проекты
        projects = query.order_by(StrategicMapProject.order_index).all()
        
        # Убеждаемся, что все поля инициализированы
        for project in projects:
            if project.milestones is None:
                project.milestones = []
            if project.children is None:
                project.children = []
        
        return projects
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Ошибка при получении проектов: {error_details}")
        # В случае ошибки возвращаем пустой список вместо падения
        # Это позволит странице загрузиться, даже если есть проблемы с данными
        try:
            # Пытаемся получить хотя бы базовые данные без relationships
            simple_query = db.query(StrategicMapProject)
            if city_id:
                simple_query = simple_query.filter(StrategicMapProject.city_id == city_id)
            simple_projects = simple_query.order_by(StrategicMapProject.order_index).all()
            # Устанавливаем пустые списки для relationships
            for p in simple_projects:
                if not hasattr(p, 'milestones') or p.milestones is None:
                    p.milestones = []
                if not hasattr(p, 'children') or p.children is None:
                    p.children = []
            return simple_projects
        except:
            raise HTTPException(status_code=500, detail=f"Ошибка при загрузке проектов: {str(e)}")


@router.post("/projects", response_model=StrategicMapProjectSchema)
def create_project(
    project: StrategicMapProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создать новый проект в мастер-карте"""
    if current_user.role not in ['admin', 'department_user']:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    # Проверяем город если указан
    if project.city_id:
        city = db.query(City).filter(City.id == project.city_id).first()
        if not city:
            raise HTTPException(status_code=404, detail="Город не найден")
    
    db_project = StrategicMapProject(
        city_id=project.city_id,
        name=project.name,
        planned_area=project.planned_area,
        total_area=project.total_area,
        floors=project.floors,
        construction_duration=project.construction_duration,
        current_status=project.current_status,
        sections_count=project.sections_count,
        sellable_area=project.sellable_area,
        order_index=project.order_index,
        is_subtotal=project.is_subtotal,
        is_total=project.is_total,
        parent_group=project.parent_group,
        parent_id=project.parent_id
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    # Создаём вехи если переданы
    if project.milestones:
        for milestone_data in project.milestones:
            milestone = StrategicMapMilestone(
                project_id=db_project.id,
                month_date=milestone_data.month_date,
                milestone_type=milestone_data.milestone_type,
                value=milestone_data.value,
                area_value=milestone_data.area_value,
                color=milestone_data.color,
                is_key_milestone=milestone_data.is_key_milestone
            )
            db.add(milestone)
        db.commit()
        db.refresh(db_project)
    
    return db_project


@router.get("/projects/{project_id}", response_model=StrategicMapProjectSchema)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить проект по ID"""
    project = db.query(StrategicMapProject).filter(StrategicMapProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    return project


@router.put("/projects/{project_id}", response_model=StrategicMapProjectSchema)
def update_project(
    project_id: int,
    project_update: StrategicMapProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить проект"""
    if current_user.role not in ['admin', 'department_user']:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    project = db.query(StrategicMapProject).filter(StrategicMapProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    update_data = project_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    
    db.commit()
    db.refresh(project)
    return project


@router.delete("/projects/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить проект"""
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    project = db.query(StrategicMapProject).filter(StrategicMapProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    # Удаляем всех детей (метрики) если они есть
    db.query(StrategicMapProject).filter(StrategicMapProject.parent_id == project_id).delete()
    
    db.delete(project)
    db.commit()
    return {"status": "deleted"}


# Milestone endpoints
@router.post("/projects/{project_id}/milestones", response_model=StrategicMapMilestoneSchema)
def create_milestone(
    project_id: int,
    milestone: StrategicMapMilestoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создать веху для проекта"""
    if current_user.role not in ['admin', 'department_user']:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    project = db.query(StrategicMapProject).filter(StrategicMapProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    db_milestone = StrategicMapMilestone(
        project_id=project_id,
        month_date=milestone.month_date,
        milestone_type=milestone.milestone_type,
        value=milestone.value,
        area_value=milestone.area_value,
        color=milestone.color,
        is_key_milestone=milestone.is_key_milestone
    )
    db.add(db_milestone)
    db.commit()
    db.refresh(db_milestone)
    return db_milestone


@router.put("/milestones/{milestone_id}", response_model=StrategicMapMilestoneSchema)
def update_milestone(
    milestone_id: int,
    milestone_update: StrategicMapMilestoneUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить веху"""
    if current_user.role not in ['admin', 'department_user']:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    milestone = db.query(StrategicMapMilestone).filter(StrategicMapMilestone.id == milestone_id).first()
    if not milestone:
        raise HTTPException(status_code=404, detail="Веха не найдена")
    
    update_data = milestone_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(milestone, field, value)
    
    db.commit()
    db.refresh(milestone)
    return milestone


@router.delete("/milestones/{milestone_id}")
def delete_milestone(
    milestone_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить веху"""
    if current_user.role not in ['admin', 'department_user']:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    milestone = db.query(StrategicMapMilestone).filter(StrategicMapMilestone.id == milestone_id).first()
    if not milestone:
        raise HTTPException(status_code=404, detail="Веха не найдена")
    
    db.delete(milestone)
    db.commit()
    return {"status": "deleted"}


@router.post("/projects/{project_id}/milestones/bulk")
def bulk_update_milestones(
    project_id: int,
    milestones: List[StrategicMapMilestoneCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Массовое обновление вех для проекта - заменяет все существующие"""
    if current_user.role not in ['admin', 'department_user']:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    project = db.query(StrategicMapProject).filter(StrategicMapProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    # Удаляем старые вехи
    db.query(StrategicMapMilestone).filter(StrategicMapMilestone.project_id == project_id).delete()
    
    # Создаём новые
    for milestone_data in milestones:
        milestone = StrategicMapMilestone(
            project_id=project_id,
            month_date=milestone_data.month_date,
            milestone_type=milestone_data.milestone_type,
            value=milestone_data.value,
            area_value=milestone_data.area_value,
            color=milestone_data.color,
            is_key_milestone=milestone_data.is_key_milestone
        )
        db.add(milestone)
    
    db.commit()
    db.refresh(project)
    return {"status": "updated", "milestones_count": len(milestones)}


@router.put("/projects/{project_id}/milestone")
def update_single_milestone(
    project_id: int,
    month_date: str,
    milestone_update: StrategicMapMilestoneUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить или создать веху для конкретного месяца"""
    if current_user.role not in ['admin', 'department_user']:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    project = db.query(StrategicMapProject).filter(StrategicMapProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    # Парсим дату
    try:
        parsed_date = datetime.fromisoformat(month_date.replace('Z', '+00:00'))
    except:
        try:
            parsed_date = datetime.strptime(month_date, '%Y-%m-%d')
        except:
            raise HTTPException(status_code=400, detail="Неверный формат даты")
    
    # Ищем существующую веху для этого месяца
    milestone = db.query(StrategicMapMilestone).filter(
        StrategicMapMilestone.project_id == project_id,
        StrategicMapMilestone.month_date == parsed_date
    ).first()
    
    if milestone:
        # Обновляем
        update_data = milestone_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(milestone, field, value)
    else:
        # Создаём новую
        milestone = StrategicMapMilestone(
            project_id=project_id,
            month_date=parsed_date,
            milestone_type=milestone_update.milestone_type,
            value=milestone_update.value,
            area_value=milestone_update.area_value,
            color=milestone_update.color,
            is_key_milestone=milestone_update.is_key_milestone or False
        )
        db.add(milestone)
    
    db.commit()
    db.refresh(project)
    return {"status": "updated"}


@router.post("/reorder")
def reorder_projects(
    order: List[int],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Изменить порядок проектов"""
    if current_user.role not in ['admin', 'department_user']:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    for idx, project_id in enumerate(order):
        project = db.query(StrategicMapProject).filter(StrategicMapProject.id == project_id).first()
        if project:
            project.order_index = idx
    
    db.commit()
    return {"status": "reordered"}


@router.post("/sync-from-cities")
def sync_projects_from_cities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Автоматически синхронизировать проекты с объектами строительства"""
    if current_user.role not in ['admin', 'department_user']:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    try:
        cities = db.query(City).all()
        created_count = 0
        updated_count = 0
        deleted_count = 0
        
        # Получаем все существующие ID городов
        city_ids = {city.id for city in cities}
        
        # Получаем все проекты, привязанные к городам
        all_projects = db.query(StrategicMapProject).filter(
            StrategicMapProject.city_id.isnot(None)
        ).all()
        
        # Удаляем проекты для городов, которых больше нет
        for project in all_projects:
            if project.city_id not in city_ids:
                db.delete(project)
                deleted_count += 1
        
        # Получаем максимальный order_index для новых проектов
        max_order = db.query(func.max(StrategicMapProject.order_index)).scalar() or 0
        
        # Создаём или обновляем проекты для существующих городов
        for city in cities:
            try:
                # Проверяем, существует ли уже проект для этого города
                existing_project = db.query(StrategicMapProject).filter(
                    StrategicMapProject.city_id == city.id
                ).first()
                
                if not existing_project:
                    # Создаём новый проект
                    project = StrategicMapProject(
                        city_id=city.id,
                        name=city.name or f"Проект {city.id}",
                        order_index=max_order + created_count + 1
                    )
                    db.add(project)
                    created_count += 1
                else:
                    # Обновляем название, если оно изменилось
                    if existing_project.name != city.name:
                        existing_project.name = city.name or existing_project.name
                        updated_count += 1
            except Exception as city_error:
                # Логируем ошибку для конкретного города, но продолжаем обработку остальных
                print(f"Ошибка при обработке города {city.id} ({city.name}): {str(city_error)}")
                continue
        
        db.commit()
        
        return {
            "status": "synced",
            "created": created_count,
            "updated": updated_count,
            "deleted": deleted_count,
            "total": len(cities)
        }
    except Exception as e:
        db.rollback()
        import traceback
        error_details = traceback.format_exc()
        print(f"Ошибка синхронизации: {error_details}")
        raise HTTPException(status_code=500, detail=f"Ошибка синхронизации: {str(e)}")
