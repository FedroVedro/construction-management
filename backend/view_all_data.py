from app.database import SessionLocal, engine
from app import models

# Create tables
models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

print("="*60)
print("ПОЛНАЯ ИНФОРМАЦИЯ О БАЗЕ ДАННЫХ")
print("="*60)

# Пользователи
print("\n" + "="*60)
print("ПОЛЬЗОВАТЕЛИ")
print("="*60)
users = db.query(models.User).all()
print(f"Всего: {len(users)}")
for user in users:
    print(f"  ID: {user.id} | {user.username} | {user.email} | Роль: {user.role}")

# Города
print("\n" + "="*60)
print("ГОРОДА (ОБЪЕКТЫ СТРОИТЕЛЬСТВА)")
print("="*60)
cities = db.query(models.City).all()
print(f"Всего: {len(cities)}")
for city in cities:
    print(f"  ID: {city.id} | {city.name}")
    if city.description:
        print(f"    Описание: {city.description}")

# Этапы строительства
print("\n" + "="*60)
print("ЭТАПЫ СТРОИТЕЛЬСТВА")
print("="*60)
stages = db.query(models.ConstructionStage).order_by(models.ConstructionStage.order_index).all()
print(f"Всего: {len(stages)}")
for stage in stages[:10]:  # Показываем первые 10
    status = "Активен" if stage.is_active else "Неактивен"
    print(f"  {stage.order_index + 1}. {stage.name} [{status}]")
if len(stages) > 10:
    print(f"  ... и еще {len(stages) - 10} этапов")

# Графики
print("\n" + "="*60)
print("ГРАФИКИ (SCHEDULES)")
print("="*60)
schedules = db.query(models.Schedule).all()
print(f"Всего: {len(schedules)}")
for schedule in schedules:
    city = db.query(models.City).filter(models.City.id == schedule.city_id).first()
    city_name = city.name if city else f"ID:{schedule.city_id}"
    print(f"\n  ID: {schedule.id}")
    print(f"    Тип: {schedule.schedule_type}")
    print(f"    Город: {city_name} (ID: {schedule.city_id})")
    print(f"    Этап: {schedule.construction_stage}")
    print(f"    Планируемые даты: {schedule.planned_start_date} - {schedule.planned_end_date}")
    if schedule.actual_start_date or schedule.actual_end_date:
        print(f"    Фактические даты: {schedule.actual_start_date} - {schedule.actual_end_date}")

# Задачи проектного офиса
print("\n" + "="*60)
print("ЗАДАЧИ ПРОЕКТНОГО ОФИСА")
print("="*60)
tasks = db.query(models.ProjectOfficeTask).all()
print(f"Всего: {len(tasks)}")
for task in tasks:
    city = db.query(models.City).filter(models.City.id == task.city_id).first()
    city_name = city.name if city else f"ID:{task.city_id}"
    print(f"\n  ID: {task.id}")
    print(f"    Город: {city_name} (ID: {task.city_id})")
    print(f"    Задача: {task.task[:50] if task.task else 'Не указано'}...")
    print(f"    Ответственный: {task.responsible or 'Не указан'}")
    print(f"    Срок: {task.due_date or 'Не указан'}")
    print(f"    Статус: {task.status or 'Не указан'}")

print("\n" + "="*60)
print("ИТОГО")
print("="*60)
print(f"Пользователи: {len(users)}")
print(f"Города: {len(cities)}")
print(f"Этапы строительства: {len(stages)}")
print(f"Графики: {len(schedules)}")
print(f"Задачи проектного офиса: {len(tasks)}")

db.close()

