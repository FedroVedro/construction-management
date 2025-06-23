from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from .. import crud, models, schemas, database, auth

router = APIRouter()

@router.get("/", response_model=List[schemas.Schedule])
def read_schedules(
    schedule_type: Optional[str] = Query(None),
    city_id: Optional[int] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Department users can only see their own schedules
    if current_user.role == "department_user":
        schedules = crud.get_schedules(
            db, 
            schedule_type=schedule_type,
            city_id=city_id,
            user_id=current_user.id,
            skip=skip, 
            limit=limit
        )
    else:
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
    # Check permissions based on role
    if current_user.role == "director":
        raise HTTPException(status_code=403, detail="Directors can only view schedules")
    
    return crud.create_schedule(db=db, schedule=schedule, user_id=current_user.id)

@router.put("/{schedule_id}", response_model=schemas.Schedule)
def update_schedule(
    schedule_id: int,
    schedule_update: schemas.ScheduleUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Check if schedule exists and user has permission
    schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    if current_user.role == "director":
        raise HTTPException(status_code=403, detail="Directors can only view schedules")
    
    if current_user.role == "department_user" and schedule.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only update your own schedules")
    
    return crud.update_schedule(db=db, schedule_id=schedule_id, schedule_update=schedule_update)

@router.delete("/{schedule_id}")
def delete_schedule(
    schedule_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.check_admin_role)
):
    success = crud.delete_schedule(db=db, schedule_id=schedule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"message": "Schedule deleted successfully"}