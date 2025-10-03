from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Boolean, Text
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String)  # admin, director, department_user
    department = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    schedules = relationship("Schedule", back_populates="creator")

class City(Base):
    __tablename__ = "cities"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    schedules = relationship("Schedule", back_populates="city")

class ConstructionStage(Base):
    __tablename__ = "construction_stages"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0)  # Для сортировки этапов
    is_active = Column(Boolean, default=True)  # Для скрытия неактуальных этапов
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    schedules = relationship("Schedule", back_populates="stage")

class Schedule(Base):
    __tablename__ = "schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    schedule_type = Column(String)  # document, hr, procurement, construction
    city_id = Column(Integer, ForeignKey("cities.id"))
    creator_id = Column(Integer, ForeignKey("users.id"))
    construction_stage_id = Column(Integer, ForeignKey("construction_stages.id"), nullable=True)
    
    # Оставляем старое поле для обратной совместимости
    construction_stage = Column(String, nullable=True)
    
    planned_start_date = Column(DateTime)
    planned_end_date = Column(DateTime)
    actual_start_date = Column(DateTime, nullable=True)
    actual_end_date = Column(DateTime, nullable=True)
    
    # Общие бюджетные показатели
    cost_plan = Column(Float, nullable=True)
    cost_fact = Column(Float, nullable=True)
    
    # Document schedule specific
    sections = Column(Text, nullable=True)
    
    # HR schedule specific
    vacancy = Column(String, nullable=True)
    quantity_plan = Column(Integer, nullable=True)
    quantity_fact = Column(Integer, nullable=True)
    
    # Procurement schedule specific
    work_name = Column(String, nullable=True)
    service = Column(String, nullable=True)
    responsible_employee = Column(String, nullable=True)
    contractor = Column(String, nullable=True)
    
    # Construction schedule specific
    workers_count = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    city = relationship("City", back_populates="schedules")
    creator = relationship("User", back_populates="schedules")
    stage = relationship("ConstructionStage", back_populates="schedules")

class ProjectOfficeTask(Base):
    __tablename__ = "project_office_tasks"

    id = Column(Integer, primary_key=True, index=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False)

    set_date = Column(DateTime, nullable=True)  # Дата постановки
    initiator = Column(String, nullable=True)  # Постановщик
    task = Column(Text, nullable=True)  # Задача
    work_name = Column(String, nullable=True)  # Наименование работ
    responsible = Column(String, nullable=True)  # Ответственный
    participants = Column(Text, nullable=True)  # Участники
    due_date = Column(Text, nullable=True)  # Срок (свободный текст)
    status = Column(String, nullable=True)  # Статус
    completion_date = Column(DateTime, nullable=True)  # Дата выполнения
    delay_reason = Column(Text, nullable=True)  # Причина переноса срока
    comments = Column(Text, nullable=True)  # Комментарии
    is_done = Column(Boolean, default=False)  # Галочка выполнено
    result = Column(Text, nullable=True)  # Результат работы
    text_color = Column(String, nullable=True)  # Цвет текста строки (hex)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    city = relationship("City")