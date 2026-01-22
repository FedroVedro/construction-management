from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user

router = APIRouter()


# ============== Task Dependencies CRUD ==============

@router.get("/task-dependencies", response_model=List[schemas.TaskDependencyWithDetails])
def get_task_dependencies(
    city_id: Optional[int] = None,
    schedule_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Получить все зависимости между задачами"""
    query = db.query(models.TaskDependency)
    
    # Фильтрация по city_id - обе задачи должны быть из этого объекта
    if city_id:
        # Получаем ID задач этого объекта
        city_schedule_ids = db.query(models.Schedule.id).filter(
            models.Schedule.city_id == city_id
        ).subquery()
        
        # Обе задачи должны быть из этого объекта
        query = query.filter(
            and_(
                models.TaskDependency.predecessor_id.in_(city_schedule_ids),
                models.TaskDependency.successor_id.in_(city_schedule_ids)
            )
        )
    
    # Дополнительная фильтрация по типу графика
    if schedule_type:
        type_schedule_ids = db.query(models.Schedule.id).filter(
            models.Schedule.schedule_type == schedule_type
        ).subquery()
        
        query = query.filter(
            or_(
                models.TaskDependency.predecessor_id.in_(type_schedule_ids),
                models.TaskDependency.successor_id.in_(type_schedule_ids)
            )
        )
    
    dependencies = query.all()
    
    # Добавляем детали о задачах
    result = []
    for dep in dependencies:
        pred = db.query(models.Schedule).filter(models.Schedule.id == dep.predecessor_id).first()
        succ = db.query(models.Schedule).filter(models.Schedule.id == dep.successor_id).first()
        
        # Получаем название объекта
        city_name = None
        if pred:
            city = db.query(models.City).filter(models.City.id == pred.city_id).first()
            city_name = city.name if city else None
        
        result.append({
            "id": dep.id,
            "predecessor_id": dep.predecessor_id,
            "successor_id": dep.successor_id,
            "link_type": dep.link_type,
            "lag_days": dep.lag_days,
            "description": dep.description,
            "created_at": dep.created_at,
            "updated_at": dep.updated_at,
            "predecessor_name": pred.work_name or pred.vacancy or pred.sections if pred else None,
            "predecessor_stage": pred.construction_stage if pred else None,
            "predecessor_type": pred.schedule_type if pred else None,
            "predecessor_city_id": pred.city_id if pred else None,
            "successor_name": succ.work_name or succ.vacancy or succ.sections if succ else None,
            "successor_stage": succ.construction_stage if succ else None,
            "successor_type": succ.schedule_type if succ else None,
            "successor_city_id": succ.city_id if succ else None,
            "city_name": city_name,
        })
    
    return result


@router.post("/task-dependencies", response_model=schemas.TaskDependency)
def create_task_dependency(
    dependency: schemas.TaskDependencyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Создать зависимость между задачами"""
    # Проверяем существование задач
    predecessor = db.query(models.Schedule).filter(models.Schedule.id == dependency.predecessor_id).first()
    successor = db.query(models.Schedule).filter(models.Schedule.id == dependency.successor_id).first()
    
    if not predecessor:
        raise HTTPException(status_code=404, detail=f"Задача-предшественник с ID {dependency.predecessor_id} не найдена")
    if not successor:
        raise HTTPException(status_code=404, detail=f"Задача-последователь с ID {dependency.successor_id} не найдена")
    
    # Проверяем, что нет циклической зависимости
    if dependency.predecessor_id == dependency.successor_id:
        raise HTTPException(status_code=400, detail="Задача не может зависеть сама от себя")
    
    # Проверяем, что обе задачи относятся к одному объекту строительства
    if predecessor.city_id != successor.city_id:
        raise HTTPException(
            status_code=400, 
            detail="Нельзя создать зависимость между задачами разных объектов строительства"
        )
    
    # Проверяем, что такой зависимости еще нет
    existing = db.query(models.TaskDependency).filter(
        models.TaskDependency.predecessor_id == dependency.predecessor_id,
        models.TaskDependency.successor_id == dependency.successor_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Такая зависимость уже существует")
    
    db_dependency = models.TaskDependency(**dependency.dict())
    db.add(db_dependency)
    db.commit()
    db.refresh(db_dependency)
    return db_dependency


@router.put("/task-dependencies/{dependency_id}", response_model=schemas.TaskDependency)
def update_task_dependency(
    dependency_id: int,
    dependency: schemas.TaskDependencyUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Обновить зависимость"""
    db_dependency = db.query(models.TaskDependency).filter(models.TaskDependency.id == dependency_id).first()
    if not db_dependency:
        raise HTTPException(status_code=404, detail="Зависимость не найдена")
    
    update_data = dependency.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_dependency, key, value)
    
    db.commit()
    db.refresh(db_dependency)
    return db_dependency


@router.delete("/task-dependencies/{dependency_id}")
def delete_task_dependency(
    dependency_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Удалить зависимость"""
    db_dependency = db.query(models.TaskDependency).filter(models.TaskDependency.id == dependency_id).first()
    if not db_dependency:
        raise HTTPException(status_code=404, detail="Зависимость не найдена")
    
    db.delete(db_dependency)
    db.commit()
    return {"message": "Зависимость удалена"}


@router.post("/task-dependencies/bulk", response_model=List[schemas.TaskDependency])
def create_bulk_dependencies(
    bulk_data: schemas.BulkDependencyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Массовое создание зависимостей"""
    created = []
    for dep in bulk_data.dependencies:
        # Проверяем существование
        existing = db.query(models.TaskDependency).filter(
            models.TaskDependency.predecessor_id == dep.predecessor_id,
            models.TaskDependency.successor_id == dep.successor_id
        ).first()
        
        if not existing and dep.predecessor_id != dep.successor_id:
            db_dep = models.TaskDependency(**dep.dict())
            db.add(db_dep)
            created.append(db_dep)
    
    db.commit()
    for dep in created:
        db.refresh(dep)
    
    return created


# ============== Work Templates CRUD ==============

@router.get("/work-templates", response_model=List[schemas.WorkTemplateWithStage])
def get_work_templates(
    schedule_type: Optional[str] = None,
    construction_stage_id: Optional[int] = None,
    is_active: Optional[bool] = True,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Получить шаблоны работ"""
    query = db.query(models.WorkTemplate)
    
    if schedule_type:
        query = query.filter(models.WorkTemplate.schedule_type == schedule_type)
    if construction_stage_id:
        query = query.filter(models.WorkTemplate.construction_stage_id == construction_stage_id)
    if is_active is not None:
        query = query.filter(models.WorkTemplate.is_active == is_active)
    
    templates = query.order_by(models.WorkTemplate.order_index).all()
    
    result = []
    for t in templates:
        stage_name = None
        if t.construction_stage_id:
            stage = db.query(models.ConstructionStage).filter(
                models.ConstructionStage.id == t.construction_stage_id
            ).first()
            stage_name = stage.name if stage else None
        
        result.append({
            "id": t.id,
            "construction_stage_id": t.construction_stage_id,
            "schedule_type": t.schedule_type,
            "work_name": t.work_name,
            "order_index": t.order_index,
            "typical_duration": t.typical_duration,
            "can_parallel": t.can_parallel,
            "is_active": t.is_active,
            "created_at": t.created_at,
            "updated_at": t.updated_at,
            "construction_stage_name": stage_name
        })
    
    return result


@router.post("/work-templates", response_model=schemas.WorkTemplate)
def create_work_template(
    template: schemas.WorkTemplateCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Создать шаблон работы"""
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Только администратор может создавать шаблоны")
    
    db_template = models.WorkTemplate(**template.dict())
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template


@router.put("/work-templates/{template_id}", response_model=schemas.WorkTemplate)
def update_work_template(
    template_id: int,
    template: schemas.WorkTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Обновить шаблон работы"""
    db_template = db.query(models.WorkTemplate).filter(models.WorkTemplate.id == template_id).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    
    update_data = template.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_template, key, value)
    
    db.commit()
    db.refresh(db_template)
    return db_template


@router.delete("/work-templates/{template_id}")
def delete_work_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Удалить шаблон работы"""
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Только администратор может удалять шаблоны")
    
    db_template = db.query(models.WorkTemplate).filter(models.WorkTemplate.id == template_id).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    
    db.delete(db_template)
    db.commit()
    return {"message": "Шаблон удален"}


@router.put("/work-templates/reorder")
def reorder_work_templates(
    order_data: List[dict],  # [{id: int, order_index: int}]
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Изменить порядок шаблонов"""
    for item in order_data:
        db.query(models.WorkTemplate).filter(
            models.WorkTemplate.id == item['id']
        ).update({'order_index': item['order_index']})
    
    db.commit()
    return {"message": "Порядок обновлен"}


# ============== Work Template Dependencies CRUD ==============

@router.get("/work-template-dependencies", response_model=List[schemas.WorkTemplateDependency])
def get_work_template_dependencies(
    template_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Получить зависимости между шаблонами"""
    query = db.query(models.WorkTemplateDependency)
    
    if template_id:
        query = query.filter(
            or_(
                models.WorkTemplateDependency.predecessor_template_id == template_id,
                models.WorkTemplateDependency.successor_template_id == template_id
            )
        )
    
    return query.all()


@router.post("/work-template-dependencies", response_model=schemas.WorkTemplateDependency)
def create_work_template_dependency(
    dependency: schemas.WorkTemplateDependencyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Создать зависимость между шаблонами"""
    if dependency.predecessor_template_id == dependency.successor_template_id:
        raise HTTPException(status_code=400, detail="Шаблон не может зависеть сам от себя")
    
    existing = db.query(models.WorkTemplateDependency).filter(
        models.WorkTemplateDependency.predecessor_template_id == dependency.predecessor_template_id,
        models.WorkTemplateDependency.successor_template_id == dependency.successor_template_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Такая зависимость уже существует")
    
    db_dep = models.WorkTemplateDependency(**dependency.dict())
    db.add(db_dep)
    db.commit()
    db.refresh(db_dep)
    return db_dep


@router.delete("/work-template-dependencies/{dependency_id}")
def delete_work_template_dependency(
    dependency_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Удалить зависимость между шаблонами"""
    db_dep = db.query(models.WorkTemplateDependency).filter(
        models.WorkTemplateDependency.id == dependency_id
    ).first()
    
    if not db_dep:
        raise HTTPException(status_code=404, detail="Зависимость не найдена")
    
    db.delete(db_dep)
    db.commit()
    return {"message": "Зависимость удалена"}


# ============== Critical Path Calculation ==============

@router.get("/dependency-graph")
def get_dependency_graph(
    city_id: Optional[int] = None,
    schedule_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Получить граф зависимостей с расчётом критического пути"""
    # Получаем задачи
    query = db.query(models.Schedule)
    if city_id:
        query = query.filter(models.Schedule.city_id == city_id)
    if schedule_type:
        query = query.filter(models.Schedule.schedule_type == schedule_type)
    
    schedules = query.all()
    
    # Получаем зависимости
    schedule_ids = [s.id for s in schedules]
    dependencies = db.query(models.TaskDependency).filter(
        and_(
            models.TaskDependency.predecessor_id.in_(schedule_ids),
            models.TaskDependency.successor_id.in_(schedule_ids)
        )
    ).all()
    
    # Формируем узлы (nodes)
    nodes = []
    for s in schedules:
        city = db.query(models.City).filter(models.City.id == s.city_id).first()
        
        duration = 0
        if s.planned_start_date and s.planned_end_date:
            duration = (s.planned_end_date - s.planned_start_date).days + 1
        
        nodes.append({
            "id": s.id,
            "name": s.work_name or s.vacancy or s.sections or "Без названия",
            "stage": s.construction_stage,
            "type": s.schedule_type,
            "city_id": s.city_id,
            "city_name": city.name if city else "Неизвестно",
            "planned_start": s.planned_start_date.isoformat() if s.planned_start_date else None,
            "planned_end": s.planned_end_date.isoformat() if s.planned_end_date else None,
            "actual_start": s.actual_start_date.isoformat() if s.actual_start_date else None,
            "actual_end": s.actual_end_date.isoformat() if s.actual_end_date else None,
            "duration": duration
        })
    
    # Формируем рёбра (edges)
    edges = []
    for d in dependencies:
        edges.append({
            "id": d.id,
            "source": d.predecessor_id,
            "target": d.successor_id,
            "link_type": d.link_type,
            "lag_days": d.lag_days
        })
    
    # Расчёт критического пути методом CPM
    critical_path = calculate_critical_path(nodes, edges)
    
    return {
        "nodes": nodes,
        "edges": edges,
        "critical_path": critical_path
    }


def calculate_critical_path(nodes: List[dict], edges: List[dict]) -> List[int]:
    """
    Расчёт критического пути методом CPM (Critical Path Method)
    
    Алгоритм:
    1. Forward Pass - вычисляем самые ранние сроки (ES, EF)
    2. Backward Pass - вычисляем самые поздние сроки (LS, LF)
    3. Критический путь = задачи с Float = 0
    """
    if not nodes:
        return []
    
    # Создаём словарь узлов
    node_dict = {n['id']: {
        **n,
        'ES': 0,  # Early Start
        'EF': 0,  # Early Finish
        'LS': float('inf'),  # Late Start
        'LF': float('inf'),  # Late Finish
        'float': 0,
        'predecessors': [],
        'successors': []
    } for n in nodes}
    
    # Заполняем связи
    for edge in edges:
        source = edge['source']
        target = edge['target']
        if source in node_dict and target in node_dict:
            node_dict[source]['successors'].append({
                'id': target,
                'link_type': edge['link_type'],
                'lag': edge['lag_days']
            })
            node_dict[target]['predecessors'].append({
                'id': source,
                'link_type': edge['link_type'],
                'lag': edge['lag_days']
            })
    
    # Находим начальные узлы (без предшественников)
    start_nodes = [nid for nid, n in node_dict.items() if not n['predecessors']]
    
    # Если нет явных начальных узлов, берём все
    if not start_nodes:
        start_nodes = list(node_dict.keys())
    
    # Forward Pass - топологическая сортировка и расчёт ES/EF
    visited = set()
    order = []
    
    def topo_sort(node_id):
        if node_id in visited:
            return
        visited.add(node_id)
        for succ in node_dict[node_id]['successors']:
            topo_sort(succ['id'])
        order.append(node_id)
    
    for start in start_nodes:
        topo_sort(start)
    
    order.reverse()
    
    # Расчёт ES и EF
    for node_id in order:
        node = node_dict[node_id]
        
        if not node['predecessors']:
            node['ES'] = 0
        else:
            max_ef = 0
            for pred in node['predecessors']:
                pred_node = node_dict.get(pred['id'])
                if pred_node:
                    link_type = pred['link_type']
                    lag = pred['lag']
                    
                    # Расчёт в зависимости от типа связи
                    if link_type == 'FS':  # Finish-to-Start
                        es = pred_node['EF'] + lag
                    elif link_type == 'SS':  # Start-to-Start
                        es = pred_node['ES'] + lag
                    elif link_type == 'FF':  # Finish-to-Finish
                        es = pred_node['EF'] + lag - node['duration']
                    elif link_type == 'SF':  # Start-to-Finish
                        es = pred_node['ES'] + lag - node['duration']
                    else:
                        es = pred_node['EF'] + lag
                    
                    max_ef = max(max_ef, es)
            
            node['ES'] = max(0, max_ef)
        
        node['EF'] = node['ES'] + node['duration']
    
    # Backward Pass - расчёт LS и LF
    project_duration = max(n['EF'] for n in node_dict.values()) if node_dict else 0
    
    # Находим конечные узлы (без последователей)
    end_nodes = [nid for nid, n in node_dict.items() if not n['successors']]
    
    for node_id in end_nodes:
        node_dict[node_id]['LF'] = project_duration
        node_dict[node_id]['LS'] = project_duration - node_dict[node_id]['duration']
    
    # Обратный проход
    for node_id in reversed(order):
        node = node_dict[node_id]
        
        if not node['successors']:
            node['LF'] = project_duration
        else:
            min_ls = float('inf')
            for succ in node['successors']:
                succ_node = node_dict.get(succ['id'])
                if succ_node:
                    link_type = succ['link_type']
                    lag = succ['lag']
                    
                    if link_type == 'FS':
                        lf = succ_node['LS'] - lag
                    elif link_type == 'SS':
                        lf = succ_node['LS'] - lag + node['duration']
                    elif link_type == 'FF':
                        lf = succ_node['LF'] - lag
                    elif link_type == 'SF':
                        lf = succ_node['LF'] - lag + node['duration']
                    else:
                        lf = succ_node['LS'] - lag
                    
                    min_ls = min(min_ls, lf)
            
            node['LF'] = min_ls if min_ls != float('inf') else project_duration
        
        node['LS'] = node['LF'] - node['duration']
        node['float'] = node['LS'] - node['ES']
    
    # Критический путь - задачи с нулевым резервом
    critical_path = [nid for nid, n in node_dict.items() if n['float'] == 0]
    
    return critical_path


# ============== Cascade Update ==============

class CascadeUpdateRequest(schemas.BaseModel):
    """Запрос на каскадное обновление"""
    schedule_id: int
    planned_start_date: str
    planned_end_date: str


class CascadeUpdateResult(schemas.BaseModel):
    """Результат каскадного обновления"""
    updated_tasks: List[dict]
    message: str


@router.post("/cascade-update", response_model=CascadeUpdateResult)
def cascade_update_schedule(
    request: CascadeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Каскадное обновление задачи и всех зависимых от неё задач.
    
    При изменении дат задачи автоматически сдвигаются все 
    последующие задачи в соответствии с типами связей.
    """
    from datetime import datetime, timedelta
    
    # Находим основную задачу
    main_task = db.query(models.Schedule).filter(models.Schedule.id == request.schedule_id).first()
    if not main_task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    
    # Парсим даты
    try:
        new_start = datetime.fromisoformat(request.planned_start_date.replace('Z', '+00:00')).replace(tzinfo=None)
        new_end = datetime.fromisoformat(request.planned_end_date.replace('Z', '+00:00')).replace(tzinfo=None)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка парсинга дат: {str(e)}")
    
    # Сохраняем старые даты для расчёта сдвига
    old_start = main_task.planned_start_date
    old_end = main_task.planned_end_date
    
    # Обновляем главную задачу
    main_task.planned_start_date = new_start
    main_task.planned_end_date = new_end
    
    updated_tasks = [{
        "id": main_task.id,
        "name": main_task.work_name or main_task.vacancy or main_task.sections,
        "planned_start_date": new_start.isoformat(),
        "planned_end_date": new_end.isoformat(),
        "is_main": True
    }]
    
    # Получаем все зависимости для объекта этой задачи
    city_schedule_ids = [s.id for s in db.query(models.Schedule).filter(
        models.Schedule.city_id == main_task.city_id
    ).all()]
    
    all_dependencies = db.query(models.TaskDependency).filter(
        and_(
            models.TaskDependency.predecessor_id.in_(city_schedule_ids),
            models.TaskDependency.successor_id.in_(city_schedule_ids)
        )
    ).all()
    
    # Строим граф зависимостей
    successors_map = {}  # predecessor_id -> list of (successor_id, link_type, lag_days)
    for dep in all_dependencies:
        if dep.predecessor_id not in successors_map:
            successors_map[dep.predecessor_id] = []
        successors_map[dep.predecessor_id].append({
            'successor_id': dep.successor_id,
            'link_type': dep.link_type,
            'lag_days': dep.lag_days
        })
    
    # Рекурсивно обновляем все зависимые задачи
    visited = set()
    to_process = [main_task.id]
    
    while to_process:
        current_id = to_process.pop(0)
        
        if current_id in visited:
            continue
        visited.add(current_id)
        
        # Получаем текущую задачу
        current_task = db.query(models.Schedule).filter(models.Schedule.id == current_id).first()
        if not current_task:
            continue
        
        # Находим все задачи, зависящие от текущей
        if current_id in successors_map:
            for dep_info in successors_map[current_id]:
                successor_id = dep_info['successor_id']
                link_type = dep_info['link_type']
                lag_days = dep_info['lag_days']
                
                if successor_id in visited:
                    continue
                
                # Получаем зависимую задачу
                successor_task = db.query(models.Schedule).filter(
                    models.Schedule.id == successor_id
                ).first()
                
                if not successor_task or not successor_task.planned_start_date:
                    continue
                
                # Рассчитываем длительность зависимой задачи
                if successor_task.planned_end_date and successor_task.planned_start_date:
                    duration = (successor_task.planned_end_date - successor_task.planned_start_date).days
                else:
                    duration = 0
                
                # Рассчитываем новые даты в зависимости от типа связи
                predecessor_start = current_task.planned_start_date
                predecessor_end = current_task.planned_end_date
                
                if link_type == 'FS':  # Finish-to-Start
                    # Задача начинается после окончания предшественника + lag
                    new_successor_start = predecessor_end + timedelta(days=lag_days + 1)
                elif link_type == 'SS':  # Start-to-Start
                    # Задача начинается вместе с предшественником + lag
                    new_successor_start = predecessor_start + timedelta(days=lag_days)
                elif link_type == 'FF':  # Finish-to-Finish
                    # Задача заканчивается вместе с предшественником + lag
                    new_successor_end = predecessor_end + timedelta(days=lag_days)
                    new_successor_start = new_successor_end - timedelta(days=duration)
                elif link_type == 'SF':  # Start-to-Finish
                    # Задача заканчивается когда предшественник начинается + lag
                    new_successor_end = predecessor_start + timedelta(days=lag_days)
                    new_successor_start = new_successor_end - timedelta(days=duration)
                else:
                    # По умолчанию FS
                    new_successor_start = predecessor_end + timedelta(days=lag_days + 1)
                
                # Рассчитываем конечную дату
                if link_type not in ['FF', 'SF']:
                    new_successor_end = new_successor_start + timedelta(days=duration)
                
                # Проверяем, изменились ли даты
                old_successor_start = successor_task.planned_start_date
                old_successor_end = successor_task.planned_end_date
                
                # Обновляем только если новые даты позже текущих (сдвиг вперёд)
                # или если явно требуется обновление (основная задача изменилась)
                if (new_successor_start != old_successor_start or 
                    new_successor_end != old_successor_end):
                    
                    successor_task.planned_start_date = new_successor_start
                    successor_task.planned_end_date = new_successor_end
                    
                    updated_tasks.append({
                        "id": successor_task.id,
                        "name": successor_task.work_name or successor_task.vacancy or successor_task.sections,
                        "planned_start_date": new_successor_start.isoformat(),
                        "planned_end_date": new_successor_end.isoformat(),
                        "is_main": False,
                        "link_type": link_type,
                        "predecessor_id": current_id
                    })
                    
                    # Добавляем в очередь для обработки его зависимостей
                    to_process.append(successor_id)
    
    # Сохраняем все изменения
    db.commit()
    
    return CascadeUpdateResult(
        updated_tasks=updated_tasks,
        message=f"Обновлено задач: {len(updated_tasks)}"
    )
