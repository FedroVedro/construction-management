from pydantic import BaseModel, EmailStr, validator
from datetime import datetime
from typing import Optional, List, Union

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
    description: Optional[str] = None

class CityCreate(CityBase):
    pass

class CityUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class City(CityBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ScheduleBase(BaseModel):
    schedule_type: str
    city_id: int
    construction_stage: str
    planned_start_date: Union[datetime, str]
    planned_end_date: Union[datetime, str]
    actual_start_date: Optional[Union[datetime, str]] = None
    actual_end_date: Optional[Union[datetime, str]] = None
    
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
    
    @validator('planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date', pre=True)
    def parse_date(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            try:
                # Попытка парсинга ISO формата
                return datetime.fromisoformat(v.replace('Z', '+00:00'))
            except:
                # Попытка парсинга простого формата даты
                try:
                    return datetime.strptime(v, '%Y-%m-%d')
                except:
                    raise ValueError(f'Неверный формат даты: {v}')
        return v
    
    @validator('schedule_type')
    def validate_schedule_type(cls, v):
        allowed_types = ['document', 'hr', 'procurement', 'construction']
        if v not in allowed_types:
            raise ValueError(f'Недопустимый тип графика: {v}. Разрешены: {allowed_types}')
        return v

class ScheduleCreate(ScheduleBase):
    pass

class ScheduleUpdate(BaseModel):
    actual_start_date: Optional[Union[datetime, str]] = None
    actual_end_date: Optional[Union[datetime, str]] = None
    quantity_fact: Optional[int] = None
    construction_stage: Optional[str] = None
    sections: Optional[str] = None
    work_name: Optional[str] = None
    vacancy: Optional[str] = None
    service: Optional[str] = None
    responsible_employee: Optional[str] = None
    contractor: Optional[str] = None
    workers_count: Optional[int] = None
    planned_start_date: Optional[Union[datetime, str]] = None
    planned_end_date: Optional[Union[datetime, str]] = None
    
    @validator('planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date', pre=True)
    def parse_date(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            if v == '':  # Пустая строка преобразуется в None
                return None
            try:
                return datetime.fromisoformat(v.replace('Z', '+00:00'))
            except:
                try:
                    return datetime.strptime(v, '%Y-%m-%d')
                except:
                    raise ValueError(f'Неверный формат даты: {v}')
        return v
    
class Schedule(ScheduleBase):
    id: int
    creator_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True