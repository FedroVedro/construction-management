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

@router.post("/", response_model=schemas.City)
def create_city(
    city: schemas.CityCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.check_admin_role)
):
    return crud.create_city(db=db, city=city)