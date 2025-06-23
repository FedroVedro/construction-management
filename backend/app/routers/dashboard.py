from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime
from .. import models, database, auth

router = APIRouter()

@router.get("/master-card")
def get_master_card_data(
    city_id: Optional[int] = Query(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    query = db.query(models.Schedule)
    if city_id:
        query = query.filter(models.Schedule.city_id == city_id)
    
    schedules = query.all()
    
    deviations = []
    for schedule in schedules:
        deviation_data = {
            "id": schedule.id,
            "type": schedule.schedule_type,
            "construction_stage": schedule.construction_stage,
            "city_id": schedule.city_id,
            "planned_start": schedule.planned_start_date,
            "planned_end": schedule.planned_end_date,
            "actual_start": schedule.actual_start_date,
            "actual_end": schedule.actual_end_date,
            "status": "on_time"  # default
        }
        
        # Calculate deviation
        if schedule.actual_end_date and schedule.planned_end_date:
            if schedule.actual_end_date > schedule.planned_end_date:
                deviation_data["status"] = "delayed"
                deviation_data["delay_days"] = (schedule.actual_end_date - schedule.planned_end_date).days
            elif schedule.actual_end_date < schedule.planned_end_date:
                deviation_data["status"] = "ahead"
                deviation_data["ahead_days"] = (schedule.planned_end_date - schedule.actual_end_date).days
        
        deviations.append(deviation_data)
    
    return {
        "total_schedules": len(schedules),
        "on_time": len([d for d in deviations if d["status"] == "on_time"]),
        "delayed": len([d for d in deviations if d["status"] == "delayed"]),
        "ahead": len([d for d in deviations if d["status"] == "ahead"]),
        "deviations": deviations
    }

@router.get("/gantt-data")
def get_gantt_data(
    city_id: Optional[int] = Query(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.check_director_or_admin_role)
):
    query = db.query(models.Schedule)
    if city_id:
        query = query.filter(models.Schedule.city_id == city_id)
    
    schedules = query.all()
    
    gantt_data = []
    for schedule in schedules:
        task_data = {
            "id": schedule.id,
            "name": f"{schedule.schedule_type} - {schedule.construction_stage}",
            "type": schedule.schedule_type,
            "start": schedule.planned_start_date.isoformat(),
            "end": schedule.planned_end_date.isoformat(),
            "progress": 0
        }
        
        # Calculate progress
        if schedule.actual_start_date:
            task_data["actualStart"] = schedule.actual_start_date.isoformat()
        if schedule.actual_end_date:
            task_data["actualEnd"] = schedule.actual_end_date.isoformat()
            task_data["progress"] = 100
        elif schedule.actual_start_date:
            # Calculate partial progress
            total_days = (schedule.planned_end_date - schedule.planned_start_date).days
            elapsed_days = (datetime.utcnow() - schedule.actual_start_date).days
            if total_days > 0:
                task_data["progress"] = min(100, int((elapsed_days / total_days) * 100))
        
        gantt_data.append(task_data)
    
    return gantt_data