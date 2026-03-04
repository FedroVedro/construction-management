from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
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
        # Получаем информацию в зависимости от типа
        detail_info = ""
        if schedule.schedule_type == "document":
            detail_info = schedule.sections or ""
        elif schedule.schedule_type == "hr":
            detail_info = schedule.vacancy or ""
        elif schedule.schedule_type in ["procurement", "construction", "marketing", "preconstruction"]:
            detail_info = schedule.work_name or ""
        
        deviation_data = {
            "id": schedule.id,
            "type": schedule.schedule_type,
            "construction_stage": schedule.construction_stage,
            "detail_info": detail_info,  # Добавляем новое поле
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


@router.get("/cost-summary")
def get_cost_summary(
    city_id: Optional[int] = Query(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.check_director_or_admin_role)
):
    """Сводка план vs факт по бюджету по объектам и отделам."""
    query = db.query(models.Schedule)
    if city_id:
        query = query.filter(models.Schedule.city_id == city_id)
    schedules = query.all()

    by_city = {}
    by_type = {}
    for s in schedules:
        plan = float(s.cost_plan or 0)
        fact = float(s.cost_fact or 0)
        cid = s.city_id or 0
        t = s.schedule_type or "other"
        by_city[cid] = by_city.get(cid, {"cost_plan": 0, "cost_fact": 0})
        by_city[cid]["cost_plan"] += plan
        by_city[cid]["cost_fact"] += fact
        by_type[t] = by_type.get(t, {"cost_plan": 0, "cost_fact": 0})
        by_type[t]["cost_plan"] += plan
        by_type[t]["cost_fact"] += fact

    cities = db.query(models.City).all()
    city_map = {c.id: c.name for c in cities}
    by_city_result = [
        {
            "city_id": cid,
            "city_name": city_map.get(cid, "Без объекта"),
            "cost_plan": round(v["cost_plan"], 2),
            "cost_fact": round(v["cost_fact"], 2)
        }
        for cid, v in by_city.items()
    ]

    type_names = {
        "document": "Документация", "hr": "HR", "procurement": "Закупки",
        "construction": "Строительство", "marketing": "Маркетинг",
        "preconstruction": "ТЗ", "other": "Прочее"
    }
    by_type_result = [
        {
            "schedule_type": t,
            "type_name": type_names.get(t, t),
            "cost_plan": round(v["cost_plan"], 2),
            "cost_fact": round(v["cost_fact"], 2)
        }
        for t, v in by_type.items()
    ]

    return {"by_city": by_city_result, "by_type": by_type_result}


@router.get("/executive-kpis")
def get_executive_kpis(
    city_id: Optional[int] = Query(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.check_director_or_admin_role)
):
    """KPI для Executive Dashboard: топ задержек, ближайшие дедлайны, прогресс по этапам."""
    query = db.query(models.Schedule)
    if city_id:
        query = query.filter(models.Schedule.city_id == city_id)
    schedules = query.all()

    deviations = []
    for s in schedules:
        status = "on_time"
        delay_days = None
        ahead_days = None
        if s.actual_end_date and s.planned_end_date:
            if s.actual_end_date > s.planned_end_date:
                status = "delayed"
                delay_days = (s.actual_end_date - s.planned_end_date).days
            elif s.actual_end_date < s.planned_end_date:
                status = "ahead"
                ahead_days = (s.planned_end_date - s.actual_end_date).days
        detail = ""
        if s.schedule_type == "document":
            detail = s.sections or ""
        elif s.schedule_type == "hr":
            detail = s.vacancy or ""
        else:
            detail = s.work_name or ""
        deviations.append({
            "id": s.id, "type": s.schedule_type, "construction_stage": s.construction_stage,
            "detail_info": detail, "status": status, "delay_days": delay_days,
            "planned_end": s.planned_end_date.isoformat() if s.planned_end_date else None,
            "actual_end": s.actual_end_date.isoformat() if s.actual_end_date else None,
        })

    top_delays = sorted(
        [d for d in deviations if d["delay_days"]],
        key=lambda x: x["delay_days"],
        reverse=True
    )[:5]

    now = datetime.utcnow()
    end_window = now + timedelta(days=14)
    upcoming = []
    for s in schedules:
        if not s.planned_end_date or s.actual_end_date:
            continue
        pe = s.planned_end_date
        if now <= pe <= end_window:
            detail = s.sections or s.vacancy or s.work_name or ""
            upcoming.append({
                "id": s.id, "type": s.schedule_type, "construction_stage": s.construction_stage,
                "detail_info": detail, "planned_end": s.planned_end_date.isoformat()
            })
    upcoming.sort(key=lambda x: x["planned_end"])

    stage_counts = {}
    for s in schedules:
        st = s.construction_stage or "Без этапа"
        stage_counts[st] = stage_counts.get(st, {"total": 0, "completed": 0})
        stage_counts[st]["total"] += 1
        if s.actual_end_date:
            stage_counts[st]["completed"] += 1
    progress_by_stage = [
        {
            "stage": st,
            "total": v["total"],
            "completed": v["completed"],
            "percent": round(100 * v["completed"] / v["total"], 1) if v["total"] else 0
        }
        for st, v in stage_counts.items()
    ]
    progress_by_stage.sort(key=lambda x: -x["percent"])

    return {
        "top_delays": top_delays,
        "upcoming_deadlines": upcoming[:10],
        "progress_by_stage": progress_by_stage
    }


@router.get("/alerts")
def get_alerts(
    city_id: Optional[int] = Query(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.check_director_or_admin_role)
):
    """Панель рисков: задачи без дат, просроченные."""
    query = db.query(models.Schedule)
    if city_id:
        query = query.filter(models.Schedule.city_id == city_id)
    schedules = query.all()
    cities = {c.id: c.name for c in db.query(models.City).all()}
    now = datetime.utcnow()

    missing_dates = []
    overdue = []
    for s in schedules:
        cn = cities.get(s.city_id, "?")
        detail = s.sections or s.vacancy or s.work_name or ""
        if not s.planned_start_date or not s.planned_end_date:
            missing_dates.append({"id": s.id, "city": cn, "type": s.schedule_type, "construction_stage": s.construction_stage, "detail": detail})
        elif not s.actual_end_date and s.planned_end_date < now:
            overdue.append({
                "id": s.id, "city": cn, "type": s.schedule_type,
                "construction_stage": s.construction_stage, "detail": detail,
                "planned_end": s.planned_end_date.isoformat(),
                "days_overdue": (now - s.planned_end_date).days
            })
    overdue.sort(key=lambda x: -x["days_overdue"])
    return {"missing_dates": missing_dates[:20], "overdue": overdue[:20]}


@router.get("/object-comparison")
def get_object_comparison(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.check_director_or_admin_role)
):
    """Сравнение объектов: задержки, в срок, опережение, бюджет, % завершённости."""
    schedules = db.query(models.Schedule).all()
    cities = {c.id: c.name for c in db.query(models.City).all()}
    result = {}
    for s in schedules:
        cid = s.city_id or 0
        if cid not in result:
            result[cid] = {"city_id": cid, "city_name": cities.get(cid, "Без объекта"), "delayed": 0, "on_time": 0, "ahead": 0, "cost_plan": 0, "cost_fact": 0, "total": 0, "completed": 0}
        r = result[cid]
        r["total"] += 1
        r["cost_plan"] += float(s.cost_plan or 0)
        r["cost_fact"] += float(s.cost_fact or 0)
        if s.actual_end_date:
            r["completed"] += 1
            if s.planned_end_date:
                if s.actual_end_date > s.planned_end_date:
                    r["delayed"] += 1
                elif s.actual_end_date < s.planned_end_date:
                    r["ahead"] += 1
                else:
                    r["on_time"] += 1
    rows = [v for k, v in result.items() if k != 0 or v["total"] > 0]
    for r in rows:
        r["cost_plan"] = round(r["cost_plan"], 2)
        r["cost_fact"] = round(r["cost_fact"], 2)
        r["percent_done"] = round(100 * r["completed"] / r["total"], 1) if r["total"] else 0
    rows.sort(key=lambda x: -x["delayed"])
    return {"objects": rows}