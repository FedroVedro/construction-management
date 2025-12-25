from app.database import SessionLocal, engine
from app import models

# Create tables
models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

print("="*50)
print("Очистка базы данных")
print("="*50)

# Подсчитываем записи перед удалением
schedules_count = db.query(models.Schedule).count()
project_office_count = db.query(models.ProjectOfficeTask).count()

print(f"\nНайдено записей:")
print(f"  Графики (schedules): {schedules_count}")
print(f"  Задачи проектного офиса: {project_office_count}")

if schedules_count == 0 and project_office_count == 0:
    print("\n✓ База данных уже пустая!")
    db.close()
    exit()

# Подтверждение
print("\n⚠️  ВНИМАНИЕ: Это удалит все графики и задачи проектного офиса!")
print("Пользователи, города и этапы строительства НЕ будут удалены.")
print("\nДля продолжения введите 'yes': ", end='')
confirmation = input().strip().lower()

if confirmation != 'yes':
    print("\n❌ Операция отменена")
    db.close()
    exit()

# Удаляем графики
print("\nУдаление графиков...")
deleted_schedules = db.query(models.Schedule).delete()
print(f"  Удалено графиков: {deleted_schedules}")

# Удаляем задачи проектного офиса
print("Удаление задач проектного офиса...")
deleted_tasks = db.query(models.ProjectOfficeTask).delete()
print(f"  Удалено задач: {deleted_tasks}")

db.commit()

print("\n" + "="*50)
print("✅ База данных очищена!")
print("="*50)
print(f"Удалено:")
print(f"  - Графиков: {deleted_schedules}")
print(f"  - Задач проектного офиса: {deleted_tasks}")
print("\nСохранено:")
print(f"  - Пользователи")
print(f"  - Города")
print(f"  - Этапы строительства")

db.close()

