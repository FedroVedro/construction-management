"""
Миграция для добавления полей days_before_rns и duration в таблицу schedules
для поддержки графика "Маркетинг и продажи"
"""

import sqlite3
import os

def migrate():
    db_path = os.path.join(os.path.dirname(__file__), 'database.db')
    
    if not os.path.exists(db_path):
        print(f"База данных не найдена: {db_path}")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Проверяем существующие столбцы
        cursor.execute("PRAGMA table_info(schedules)")
        columns = [col[1] for col in cursor.fetchall()]
        
        # Добавляем days_before_rns если не существует
        if 'days_before_rns' not in columns:
            cursor.execute("ALTER TABLE schedules ADD COLUMN days_before_rns INTEGER")
            print("Добавлен столбец: days_before_rns")
        else:
            print("Столбец days_before_rns уже существует")
        
        # Добавляем duration если не существует
        if 'duration' not in columns:
            cursor.execute("ALTER TABLE schedules ADD COLUMN duration INTEGER")
            print("Добавлен столбец: duration")
        else:
            print("Столбец duration уже существует")
        
        conn.commit()
        print("Миграция успешно завершена!")
        return True
        
    except Exception as e:
        print(f"Ошибка миграции: {e}")
        conn.rollback()
        return False
        
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()

