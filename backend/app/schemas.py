from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List

class UserBase(BaseModel):
    username: str
    email: EmailStr
    role: str
    department: Optional[str] = None

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class CityBase(BaseModel):
    name: str
    departments: str

class CityCreate(CityBase):
    pass

class City(CityBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class ScheduleBase(BaseModel):
    schedule_type: str
    city_id: int
    construction_stage: str
    planned_start_date: datetime
    planned_end_date: datetime
    actual_start_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None
    
    # Document schedule
    sections: Optional[str] = None
    
    # HR schedule
    vacancy: Optional[str] = None
    quantity_plan: Optional[int] = None
    quantity_fact: Optional[int] = None
    
    # Procurement schedule
    work_name: Optional[str] = None
    service: Optional[str] = None
    responsible_employee: Optional[str] = None
    contractor: Optional[str] = None
    
    # Construction schedule
    workers_count: Optional[int] = None

class ScheduleCreate(ScheduleBase):
    pass

class ScheduleUpdate(BaseModel):
    actual_start_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None
    quantity_fact: Optional[int] = None
    
class Schedule(ScheduleBase):
    id: int
    creator_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True