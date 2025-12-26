"""
Миграция для добавления поля construction_stage в таблицу project_office_tasks
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
        # Проверяем существует ли колонка
        cursor.execute("PRAGMA table_info(project_office_tasks)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'construction_stage' in columns:
            print("Колонка construction_stage уже существует в таблице project_office_tasks")
            return True
        
        # Добавляем колонку
        print("Добавляем колонку construction_stage в таблицу project_office_tasks...")
        cursor.execute("ALTER TABLE project_office_tasks ADD COLUMN construction_stage VARCHAR")
        conn.commit()
        
        print("Миграция выполнена успешно!")
        
        # Пробуем автоматически заполнить этапы строительства на основе work_name
        print("Заполняем этапы строительства на основе наименований работ...")
        
        # Получаем все задачи с work_name
        cursor.execute("SELECT id, city_id, work_name FROM project_office_tasks WHERE work_name IS NOT NULL AND work_name != ''")
        tasks = cursor.fetchall()
        
        updated_count = 0
        for task_id, city_id, work_name in tasks:
            work_name = work_name.strip() if work_name else ''
            if not work_name:
                continue
            
            # Ищем этап в schedules
            cursor.execute("""
                SELECT construction_stage FROM schedules 
                WHERE city_id = ? AND (work_name = ? OR sections = ?)
                AND construction_stage IS NOT NULL AND construction_stage != ''
                LIMIT 1
            """, (city_id, work_name, work_name))
            
            result = cursor.fetchone()
            if result and result[0]:
                cursor.execute(
                    "UPDATE project_office_tasks SET construction_stage = ? WHERE id = ?",
                    (result[0], task_id)
                )
                updated_count += 1
        
        conn.commit()
        print(f"Обновлено {updated_count} задач с этапами строительства")
        
        return True
        
    except Exception as e:
        print(f"Ошибка миграции: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()

