"""
Скрипт миграции для добавления таблицы этапов строительства
"""

import sqlite3
from app.database import engine
from app import models, crud, schemas
from app.database import SessionLocal

def migrate_construction_stages():
    """Миграция для создания таблицы этапов строительства"""
    
    # Создаем таблицы через SQLAlchemy
    print("Создаем новые таблицы...")
    models.Base.metadata.create_all(bind=engine)
    
    # Создаем сессию
    db = SessionLocal()
    
    try:
        # Создаем стандартные этапы строительства
        default_stages = [
            {"name": "Подготовительные работы", "description": "Подготовка территории, временные сооружения", "order_index": 1},
            {"name": "Земляные работы", "description": "Разработка котлована, планировка территории", "order_index": 2},
            {"name": "Фундамент", "description": "Устройство фундамента и гидроизоляции", "order_index": 3},
            {"name": "Подземная часть", "description": "Строительство подземных этажей", "order_index": 4},
            {"name": "Надземная часть", "description": "Возведение надземных этажей", "order_index": 5},
            {"name": "Кровля", "description": "Устройство кровли и водостоков", "order_index": 6},
            {"name": "Фасадные работы", "description": "Отделка и утепление фасадов", "order_index": 7},
            {"name": "Внутренние инженерные сети", "description": "Монтаж систем отопления, водоснабжения, электрики", "order_index": 8},
            {"name": "Внутренняя отделка", "description": "Черновая и чистовая отделка помещений", "order_index": 9},
            {"name": "Наружные сети", "description": "Подключение к городским коммуникациям", "order_index": 10},
            {"name": "Благоустройство", "description": "Устройство дорог, тротуаров, озеленение", "order_index": 11},
            {"name": "Сдача объекта", "description": "Приемка работ, устранение замечаний", "order_index": 12},
        ]
        
        print("Создаем стандартные этапы строительства...")
        for stage_data in default_stages:
            # Проверяем, существует ли уже этап
            existing = db.query(models.ConstructionStage).filter(
                models.ConstructionStage.name == stage_data["name"]
            ).first()
            
            if not existing:
                stage = models.ConstructionStage(**stage_data)
                db.add(stage)
                print(f"✓ Создан этап: {stage_data['name']}")
            else:
                print(f"- Этап уже существует: {stage_data['name']}")
        
        db.commit()
        
        # Мигрируем существующие записи Schedule
        print("\nМигрируем существующие графики...")
        schedules = db.query(models.Schedule).filter(
            models.Schedule.construction_stage != None,
            models.Schedule.construction_stage != "",
            models.Schedule.construction_stage_id == None
        ).all()
        
        migrated_count = 0
        for schedule in schedules:
            # Ищем соответствующий этап
            stage = db.query(models.ConstructionStage).filter(
                models.ConstructionStage.name == schedule.construction_stage
            ).first()
            
            if stage:
                schedule.construction_stage_id = stage.id
                migrated_count += 1
            else:
                # Создаем новый этап если не найден
                new_stage = models.ConstructionStage(
                    name=schedule.construction_stage,
                    description="Импортирован из существующих данных",
                    order_index=100  # В конец списка
                )
                db.add(new_stage)
                db.flush()  # Чтобы получить ID
                schedule.construction_stage_id = new_stage.id
                migrated_count += 1
                print(f"✓ Создан новый этап из данных: {schedule.construction_stage}")
        
        db.commit()
        print(f"\n✓ Мигрировано записей: {migrated_count}")
        
        # Добавляем индекс для производительности
        conn = sqlite3.connect(str(engine.url).replace('sqlite:///', ''))
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_construction_stages_name 
                ON construction_stages(name)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_schedules_construction_stage_id 
                ON schedules(construction_stage_id)
            """)
            conn.commit()
            print("\n✓ Индексы созданы")
        except Exception as e:
            print(f"⚠ Ошибка при создании индексов: {e}")
        finally:
            conn.close()
            
        print("\n✅ Миграция успешно завершена!")
        
    except Exception as e:
        print(f"\n❌ Ошибка при миграции: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate_construction_stages()