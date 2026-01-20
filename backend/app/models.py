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
    visible_in_schedules = Column(Boolean, default=True)  # Отображать объект в графиках отделов
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    schedules = relationship("Schedule", back_populates="city")
    strategic_projects = relationship("StrategicMapProject", back_populates="city", cascade="all, delete-orphan")

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
    
    # Marketing schedule specific
    days_before_rns = Column(Integer, nullable=True)  # За сколько дней до РНС
    duration = Column(Integer, nullable=True)  # Длительность (в днях)
    
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
    construction_stage = Column(String, nullable=True)  # Этап строительства
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


class StrategicMapProject(Base):
    """Проект в мастер-карте стратегического развития"""
    __tablename__ = "strategic_map_projects"

    id = Column(Integer, primary_key=True, index=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=True)  # Связь с объектом строительства
    
    name = Column(String, nullable=False)  # Название проекта (например, "Краснодар 1")
    planned_area = Column(Float, nullable=True)  # Плановая площадь, м2
    total_area = Column(Float, nullable=True)  # Общая площадь
    floors = Column(Integer, nullable=True)  # Этажность
    construction_duration = Column(Integer, nullable=True)  # Срок строительства, мес
    
    # Новые поля
    current_status = Column(String, nullable=True)  # Текущий статус (РНВ, стр-во, ПФ, РНС и т.д.)
    sections_count = Column(Integer, nullable=True)  # Кол-во секций
    sellable_area = Column(Float, nullable=True)  # Продаваемая площадь (М2)
    
    order_index = Column(Integer, default=0)  # Порядок сортировки
    is_subtotal = Column(Boolean, default=False)  # Это строка подытога
    is_total = Column(Boolean, default=False)  # Это итоговая строка
    parent_group = Column(String, nullable=True)  # Группа (для подытогов)
    parent_id = Column(Integer, ForeignKey("strategic_map_projects.id"), nullable=True) # Родительский проект
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    city = relationship("City", back_populates="strategic_projects")
    parent = relationship("StrategicMapProject", remote_side=[id], backref="children")
    milestones = relationship("StrategicMapMilestone", back_populates="project", cascade="all, delete-orphan")


class StrategicMapMilestone(Base):
    """Вехи/этапы в мастер-карте - привязка к месяцам"""
    __tablename__ = "strategic_map_milestones"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("strategic_map_projects.id"), nullable=False)
    
    month_date = Column(DateTime, nullable=False)  # Месяц (первое число месяца)
    milestone_type = Column(String, nullable=True)  # Тип вехи: РНС, Продажа, Строительство и т.д. (первая строка - статус)
    value = Column(Text, nullable=True)  # Значение/описание (может быть числом или текстом)
    area_value = Column(Float, nullable=True)  # Значение площади в м2 (вторая строка)
    color = Column(String, nullable=True)  # Цвет ячейки (hex)
    is_key_milestone = Column(Boolean, default=False)  # Ключевая веха (РНС, завершение)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("StrategicMapProject", back_populates="milestones")