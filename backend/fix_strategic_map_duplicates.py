"""
Скрипт для удаления дубликатов проектов в стратегической карте
"""

import sqlite3
from app.database import engine

def fix_duplicates():
    """Удаление дубликатов проектов по city_id"""
    
    # Получаем путь к базе данных
    db_path = str(engine.url).replace('sqlite:///', '')
    
    # Подключаемся к базе данных
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("=" * 70)
        print("Поиск и удаление дубликатов в таблице strategic_map_projects")
        print("=" * 70)
        
        # Находим дубликаты - проекты с одинаковым city_id
        cursor.execute("""
            SELECT city_id, COUNT(*) as count
            FROM strategic_map_projects
            WHERE city_id IS NOT NULL
            GROUP BY city_id
            HAVING COUNT(*) > 1
        """)
        
        duplicates = cursor.fetchall()
        
        if not duplicates:
            print("[OK] Дубликатов не найдено!")
            return
        
        print(f"\n[!] Найдено дубликатов: {len(duplicates)}")
        
        total_deleted = 0
        
        for city_id, count in duplicates:
            print(f"\nОбрабатываем city_id={city_id} (найдено {count} записей)...")
            
            # Получаем все проекты для этого city_id, отсортированные по id
            cursor.execute("""
                SELECT id, name, order_index
                FROM strategic_map_projects
                WHERE city_id = ?
                ORDER BY id ASC
            """, (city_id,))
            
            projects = cursor.fetchall()
            
            # Оставляем первый проект, удаляем остальные
            keep_id = projects[0][0]
            keep_name = projects[0][1]
            print(f"  Оставляем: id={keep_id}, name='{keep_name}'")
            
            for project_id, name, order_index in projects[1:]:
                print(f"  Удаляем дубликат: id={project_id}, name='{name}'")
                
                # Сначала удаляем связанные milestones
                cursor.execute("""
                    DELETE FROM strategic_map_milestones
                    WHERE project_id = ?
                """, (project_id,))
                
                milestones_deleted = cursor.rowcount
                if milestones_deleted > 0:
                    print(f"    - Удалено {milestones_deleted} milestones")
                
                # Удаляем проект
                cursor.execute("""
                    DELETE FROM strategic_map_projects
                    WHERE id = ?
                """, (project_id,))
                
                total_deleted += 1
        
        conn.commit()
        print("\n" + "=" * 70)
        print(f"[OK] Успешно удалено {total_deleted} дубликатов!")
        print("=" * 70)
        
    except Exception as e:
        print(f"\n[ERROR] Ошибка: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print("\nВНИМАНИЕ: Этот скрипт удалит дубликаты проектов из стратегической карты.")
    print("Будут сохранены только первые записи для каждого объекта.\n")
    
    fix_duplicates()
    
    print("\nГотово! Теперь можно обновить страницу Мастер-карты.")
