from app.database import SessionLocal, engine
from app import models

# Create tables
models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

print("="*50)
print("Проверка базы данных")
print("="*50)

# Проверяем количество записей в каждой таблице
users_count = db.query(models.User).count()
cities_count = db.query(models.City).count()
stages_count = db.query(models.ConstructionStage).count()
schedules_count = db.query(models.Schedule).count()
project_office_count = db.query(models.ProjectOfficeTask).count()

print(f"\nПользователи: {users_count}")
print(f"Города: {cities_count}")
print(f"Этапы строительства: {stages_count}")
print(f"Графики (schedules): {schedules_count}")
print(f"Задачи проектного офиса: {project_office_count}")

if schedules_count > 0:
    print("\n" + "="*50)
    print("Найдены графики в базе данных:")
    print("="*50)
    schedules = db.query(models.Schedule).limit(10).all()
    for schedule in schedules:
        print(f"\nID: {schedule.id}")
        print(f"  Тип: {schedule.schedule_type}")
        print(f"  Город ID: {schedule.city_id}")
        print(f"  Этап: {schedule.construction_stage}")
        print(f"  Планируемая дата начала: {schedule.planned_start_date}")
        print(f"  Планируемая дата окончания: {schedule.planned_end_date}")
else:
    print("\n✓ База данных пустая - графиков нет")

db.close()

