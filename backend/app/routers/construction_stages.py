from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from .. import crud, models, schemas, database, auth

router = APIRouter()

@router.get("/", response_model=List[schemas.ConstructionStage])
def read_construction_stages(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = Query(False, description="Показать только активные этапы"),
    search: Optional[str] = Query(None, description="Поиск по названию или описанию"),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Получить список этапов строительства"""
    stages = crud.get_construction_stages(
        db, 
        skip=skip, 
        limit=limit, 
        active_only=active_only,
        search=search
    )
    return stages

@router.get("/{stage_id}", response_model=schemas.ConstructionStage)
def read_construction_stage(
    stage_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Получить информацию об этапе строительства"""
    stage = crud.get_construction_stage(db, stage_id=stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail="Этап строительства не найден")
    return stage

@router.post("/", response_model=schemas.ConstructionStage)
def create_construction_stage(
    stage: schemas.ConstructionStageCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.check_admin_role)
):
    """Создать новый этап строительства (только для администратора)"""
    # Проверяем, существует ли уже этап с таким названием
    existing_stage = crud.get_construction_stage_by_name(db, stage.name)
    if existing_stage:
        raise HTTPException(status_code=400, detail="Этап с таким названием уже существует")
    
    return crud.create_construction_stage(db=db, stage=stage)

@router.put("/{stage_id}", response_model=schemas.ConstructionStage)
def update_construction_stage(
    stage_id: int,
    stage_update: schemas.ConstructionStageUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.check_admin_role)
):
    """Обновить этап строительства (только для администратора)"""
    # Если обновляется название, проверяем уникальность
    if stage_update.name:
        existing_stage = crud.get_construction_stage_by_name(db, stage_update.name)
        if existing_stage and existing_stage.id != stage_id:
            raise HTTPException(status_code=400, detail="Этап с таким названием уже существует")
    
    stage = crud.update_construction_stage(db, stage_id=stage_id, stage_update=stage_update)
    if not stage:
        raise HTTPException(status_code=404, detail="Этап строительства не найден")
    return stage

@router.delete("/{stage_id}")
def delete_construction_stage(
    stage_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.check_admin_role)
):
    """Удалить этап строительства (только для администратора)"""
    success = crud.delete_construction_stage(db, stage_id=stage_id)
    if success is None:
        raise HTTPException(status_code=404, detail="Этап строительства не найден")
    elif success is False:
        return {"message": "Этап используется в графиках и был деактивирован вместо удаления"}
    else:
        return {"message": "Этап строительства успешно удален"}

@router.post("/reorder")
def reorder_construction_stages(
    stage_ids: List[int],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.check_admin_role)
):
    """Изменить порядок этапов строительства (только для администратора)"""
    for index, stage_id in enumerate(stage_ids):
        stage = crud.get_construction_stage(db, stage_id)
        if stage:
            stage.order_index = index
    
    db.commit()
    return {"message": "Порядок этапов успешно обновлен"}