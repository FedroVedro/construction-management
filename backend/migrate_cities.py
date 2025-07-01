"""
Скрипт миграции для обновления таблицы cities:
- Переименовывает колонку departments в description
- Очищает содержимое колонки description
"""

import sqlite3
from app.database import engine
from app import models

def migrate_cities_table():
    """Миграция таблицы cities"""
    
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
        
        if 'departments' in column_names and 'description' not in column_names:
            print("Начинаем миграцию таблицы cities...")
            
            # Создаем временную таблицу с новой структурой
            cursor.execute("""
                CREATE TABLE cities_new (
                    id INTEGER PRIMARY KEY,
                    name VARCHAR UNIQUE,
                    description TEXT,
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """)
            
            # Копируем данные
            cursor.execute("""
                INSERT INTO cities_new (id, name, description, created_at, updated_at)
                SELECT id, name, NULL, created_at, datetime('now') FROM cities
            """)
            
            # Удаляем старую таблицу
            cursor.execute("DROP TABLE cities")
            
            # Переименовываем новую таблицу
            cursor.execute("ALTER TABLE cities_new RENAME TO cities")
            
            # Создаем индекс
            cursor.execute("CREATE INDEX ix_cities_name ON cities (name)")
            cursor.execute("CREATE INDEX ix_cities_id ON cities (id)")
            
            conn.commit()
            print("Миграция успешно завершена!")
            
        elif 'description' in column_names:
            print("Таблица cities уже имеет колонку description. Миграция не требуется.")
        else:
            print("Неожиданная структура таблицы cities.")
            
    except Exception as e:
        print(f"Ошибка при миграции: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_cities_table()
    
    # Создаем или обновляем таблицы через SQLAlchemy
    print("\nОбновляем структуру базы данных через SQLAlchemy...")
    models.Base.metadata.create_all(bind=engine)
    print("Готово!")