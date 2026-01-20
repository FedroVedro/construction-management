"""
Скрипт миграции для добавления поля visible_in_schedules в таблицу cities
Это поле будет управлять видимостью объектов в графиках отделов
"""

import sqlite3
from app.database import engine
from app import models

def migrate_add_visible_in_schedules():
    """Добавление поля visible_in_schedules в таблицу cities"""
    
    # Получаем путь к базе данных из engine
    db_path = str(engine.url).replace('sqlite:///', '')
    
    # Подключаемся к базе данных
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Проверяем структуру текущей таблицы
        cursor.execute("PRAGMA table_info(cities)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        if 'visible_in_schedules' not in column_names:
            print("Начинаем миграцию: добавление поля visible_in_schedules в таблицу cities...")
            
            # Добавляем новую колонку со значением по умолчанию True
            cursor.execute("""
                ALTER TABLE cities 
                ADD COLUMN visible_in_schedules BOOLEAN DEFAULT 1
            """)
            
            # Устанавливаем значение True для всех существующих записей
            cursor.execute("""
                UPDATE cities 
                SET visible_in_schedules = 1 
                WHERE visible_in_schedules IS NULL
            """)
            
            conn.commit()
            print("[OK] Миграция успешно завершена! Поле visible_in_schedules добавлено.")
            print("     Все существующие объекты будут отображаться в графиках по умолчанию.")
            
        else:
            print("[OK] Поле visible_in_schedules уже существует. Миграция не требуется.")
            
    except Exception as e:
        print(f"[ERROR] Ошибка при миграции: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print("=" * 70)
    print("Миграция базы данных: добавление управления видимостью объектов")
    print("=" * 70)
    
    migrate_add_visible_in_schedules()
    
    # Обновляем структуру базы данных через SQLAlchemy
    print("\nОбновляем структуру базы данных через SQLAlchemy...")
    models.Base.metadata.create_all(bind=engine)
    print("[OK] Готово!")
    print("\nТеперь вы можете управлять видимостью объектов в графиках отделов")
    print("через интерфейс управления объектами строительства.")
