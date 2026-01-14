"""
Простой скрипт для создания новой базы данных
Используйте этот скрипт, если repair_database.py не работает из-за блокировки файла
"""
import os
import shutil
from datetime import datetime

DB_PATH = "database.db"

def create_new_database():
    """Создает новую базу данных"""
    print("=" * 60)
    print("Создание новой базы данных")
    print("=" * 60)
    
    # Переименовываем старую базу (если существует)
    if os.path.exists(DB_PATH):
        backup_name = f"database_corrupted_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        try:
            shutil.move(DB_PATH, backup_name)
            print(f"Старая база данных переименована в: {backup_name}")
        except Exception as e:
            print(f"Не удалось переименовать старую базу: {e}")
            print("Пожалуйста, остановите сервер и закройте все программы, использующие базу данных")
            print("Затем переименуйте database.db вручную и запустите скрипт снова")
            return False
    
    # Импортируем модели и создаем структуру
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    
    try:
        from app.database import engine, Base
        from app import models
        
        print("Создание структуры базы данных...")
        # Создаем все таблицы
        Base.metadata.create_all(bind=engine)
        print("✓ Новая база данных создана успешно!")
        print()
        print("ВНИМАНИЕ: Все данные были потеряны.")
        print()
        print("Следующие шаги для восстановления данных:")
        print("1. python create_admin.py - создать администратора")
        print("2. python create_departament_users.py - создать пользователей отделов")
        print("3. python create_sample_stages.py - создать этапы строительства")
        print("4. python migrate_cities.py - мигрировать города (если есть данные)")
        print()
        print("После этого можно запустить сервер: uvicorn app.main:app --reload --port 8000")
        return True
    except Exception as e:
        print(f"✗ Ошибка при создании новой базы данных: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if create_new_database():
        print("=" * 60)
        print("Готово!")
        print("=" * 60)
    else:
        print("=" * 60)
        print("Ошибка! См. инструкции выше.")
        print("=" * 60)
