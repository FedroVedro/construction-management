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
    visible_in_schedules: Optional[bool] = True

class CityCreate(CityBase):
    pass

class CityUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    visible_in_schedules: Optional[bool] = None

class City(CityBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    current_status: Optional[str] = None  # Статус из Мастер-карты
    
    class Config:
        from_attributes = True

class ConstructionStageBase(BaseModel):
    name: str
    description: Optional[str] = None
    order_index: Optional[int] = 0
    is_active: Optional[bool] = True

class ConstructionStageCreate(ConstructionStageBase):
    pass

class ConstructionStageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    order_index: Optional[int] = None
    is_active: Optional[bool] = None

class ConstructionStage(ConstructionStageBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ScheduleBase(BaseModel):
    schedule_type: str
    city_id: int
    construction_stage_id: Optional[int] = None
    construction_stage: Optional[str] = None  # Для обратной совместимости
    planned_start_date: Union[datetime, str]
    planned_end_date: Union[datetime, str]
    actual_start_date: Optional[Union[datetime, str]] = None
    actual_end_date: Optional[Union[datetime, str]] = None
    cost_plan: Optional[float] = None
    cost_fact: Optional[float] = None
    
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
    
    # Marketing schedule
    days_before_rns: Optional[int] = None  # За сколько дней до РНС
    duration: Optional[int] = None  # Длительность (в днях)
    
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
        allowed_types = ['document', 'hr', 'procurement', 'construction', 'marketing']
        if v not in allowed_types:
            raise ValueError(f'Недопустимый тип графика: {v}. Разрешены: {allowed_types}')
        return v

class ScheduleCreate(ScheduleBase):
    pass

class ScheduleUpdate(BaseModel):
    construction_stage_id: Optional[int] = None
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
    cost_plan: Optional[float] = None
    cost_fact: Optional[float] = None
    days_before_rns: Optional[int] = None
    duration: Optional[int] = None
    
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
    stage: Optional[ConstructionStage] = None
    
    class Config:
        from_attributes = True

# Project Office Task schemas
class ProjectOfficeTaskBase(BaseModel):
    city_id: int
    set_date: Optional[Union[datetime, str]] = None
    initiator: Optional[str] = None
    construction_stage: Optional[str] = None
    work_name: Optional[str] = None
    task: Optional[str] = None
    responsible: Optional[str] = None
    participants: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None
    completion_date: Optional[Union[datetime, str]] = None
    delay_reason: Optional[str] = None
    comments: Optional[str] = None
    is_done: Optional[bool] = False
    result: Optional[str] = None
    text_color: Optional[str] = None

    @validator('set_date', 'completion_date', pre=True)
    def parse_optional_date(cls, v):
        if v is None or v == '':
            return None
        if isinstance(v, str):
            try:
                return datetime.fromisoformat(v.replace('Z', '+00:00'))
            except:
                try:
                    return datetime.strptime(v, '%Y-%m-%d')
                except:
                    raise ValueError(f'Неверный формат даты: {v}')
        return v

    @validator('status')
    def validate_status(cls, v):
        if v is None or v == '':
            return None
        allowed = ['Отложено', 'В работе', 'Не актуально', 'Выполнено']
        if v not in allowed:
            raise ValueError(f"Недопустимый статус: {v}. Разрешены: {allowed}")
        return v

class ProjectOfficeTaskCreate(ProjectOfficeTaskBase):
    pass

class ProjectOfficeTaskUpdate(BaseModel):
    set_date: Optional[Union[datetime, str]] = None
    initiator: Optional[str] = None
    construction_stage: Optional[str] = None
    work_name: Optional[str] = None
    task: Optional[str] = None
    responsible: Optional[str] = None
    participants: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None
    completion_date: Optional[Union[datetime, str]] = None
    delay_reason: Optional[str] = None
    comments: Optional[str] = None
    is_done: Optional[bool] = None
    result: Optional[str] = None
    text_color: Optional[str] = None

    @validator('set_date', 'completion_date', pre=True)
    def parse_optional_date_update(cls, v):
        if v is None or v == '':
            return None
        if isinstance(v, str):
            try:
                return datetime.fromisoformat(v.replace('Z', '+00:00'))
            except:
                try:
                    return datetime.strptime(v, '%Y-%m-%d')
                except:
                    raise ValueError(f'Неверный формат даты: {v}')
        return v

    @validator('status')
    def validate_status_update(cls, v):
        if v is None or v == '':
            return None
        allowed = ['Отложено', 'В работе', 'Не актуально', 'Выполнено']
        if v not in allowed:
            raise ValueError(f"Недопустимый статус: {v}. Разрешены: {allowed}")
        return v

class ProjectOfficeTask(ProjectOfficeTaskBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Strategic Map schemas
class StrategicMapMilestoneBase(BaseModel):
    month_date: Union[datetime, str]
    milestone_type: Optional[str] = None
    value: Optional[str] = None
    area_value: Optional[float] = None  # Значение площади в м2 (вторая строка)
    color: Optional[str] = None
    is_key_milestone: Optional[bool] = False

    @validator('month_date', pre=True)
    def parse_month_date(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            try:
                return datetime.fromisoformat(v.replace('Z', '+00:00'))
            except:
                try:
                    return datetime.strptime(v, '%Y-%m-%d')
                except:
                    raise ValueError(f'Неверный формат даты: {v}')
        return v


class StrategicMapMilestoneCreate(StrategicMapMilestoneBase):
    pass


class StrategicMapMilestoneUpdate(BaseModel):
    milestone_type: Optional[str] = None
    value: Optional[str] = None
    area_value: Optional[float] = None  # Значение площади в м2 (вторая строка)
    color: Optional[str] = None
    is_key_milestone: Optional[bool] = None


class StrategicMapMilestone(StrategicMapMilestoneBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StrategicMapProjectBase(BaseModel):
    city_id: Optional[int] = None
    name: str
    planned_area: Optional[float] = None
    total_area: Optional[float] = None
    floors: Optional[int] = None
    construction_duration: Optional[int] = None
    current_status: Optional[str] = None  # Текущий статус (РНВ, стр-во, ПФ, РНС и т.д.)
    sections_count: Optional[int] = None  # Кол-во секций
    sellable_area: Optional[float] = None  # Продаваемая площадь (М2)
    order_index: Optional[int] = 0
    is_subtotal: Optional[bool] = False
    is_total: Optional[bool] = False
    parent_group: Optional[str] = None
    parent_id: Optional[int] = None


class StrategicMapProjectCreate(StrategicMapProjectBase):
    milestones: Optional[List[StrategicMapMilestoneCreate]] = []


class StrategicMapProjectUpdate(BaseModel):
    city_id: Optional[int] = None
    name: Optional[str] = None
    planned_area: Optional[float] = None
    total_area: Optional[float] = None
    floors: Optional[int] = None
    construction_duration: Optional[int] = None
    current_status: Optional[str] = None
    sections_count: Optional[int] = None
    sellable_area: Optional[float] = None
    order_index: Optional[int] = None
    is_subtotal: Optional[bool] = None
    is_total: Optional[bool] = None
    parent_group: Optional[str] = None
    parent_id: Optional[int] = None


class StrategicMapProject(StrategicMapProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime
    milestones: List[StrategicMapMilestone] = []

    class Config:
        from_attributes = True


class StrategicMapBulkUpdate(BaseModel):
    """Массовое обновление вех для проекта"""
    project_id: int
    milestones: List[StrategicMapMilestoneCreate]