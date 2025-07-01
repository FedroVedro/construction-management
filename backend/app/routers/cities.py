from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import crud, models, schemas, database, auth

router = APIRouter()

@router.get("/", response_model=List[schemas.City])
def read_cities(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    cities = crud.get_cities(db, skip=skip, limit=limit)
    return cities

@router.get("/{city_id}", response_model=schemas.City)
def read_city(
    city_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    city = crud.get_city(db, city_id=city_id)
    if not city:
        raise HTTPException(status_code=404, detail="Объект строительства не найден")
    return city

@router.post("/", response_model=schemas.City)
def create_city(
    city: schemas.CityCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.check_admin_role)
):
    return crud.create_city(db=db, city=city)

@router.put("/{city_id}", response_model=schemas.City)
def update_city(
    city_id: int,
    city_update: schemas.CityUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.check_admin_role)
):
    city = crud.update_city(db, city_id=city_id, city_update=city_update)
    if not city:
        raise HTTPException(status_code=404, detail="Объект строительства не найден")
    return city

@router.delete("/{city_id}")
def delete_city(
    city_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.check_admin_role)
):
    success = crud.delete_city(db, city_id=city_id)
    if not success:
        raise HTTPException(status_code=404, detail="Объект строительства не найден")
    return {"message": "Объект строительства успешно удален"}