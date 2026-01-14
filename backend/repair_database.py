"""
Скрипт для восстановления поврежденной базы данных SQLite
"""
import sqlite3
import os
import shutil
from datetime import datetime

DB_PATH = "database.db"
BACKUP_PATH = f"database_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"

def try_repair_database():
    """Пытается восстановить базу данных"""
    print("Попытка восстановления базы данных...")
    
    if not os.path.exists(DB_PATH):
        print(f"База данных {DB_PATH} не найдена. Будет создана новая.")
        return True
    
    # Создаем резервную копию
    try:
        shutil.copy2(DB_PATH, BACKUP_PATH)
        print(f"Создана резервная копия: {BACKUP_PATH}")
    except Exception as e:
        print(f"Не удалось создать резервную копию: {e}")
        return False
    
    # Пытаемся восстановить через .dump и .read
    try:
        # Создаем временный файл для дампа
        dump_file = "database_dump.sql"
        
        # Пытаемся сделать дамп
        source_conn = sqlite3.connect(DB_PATH)
        with open(dump_file, 'w', encoding='utf-8') as f:
            for line in source_conn.iterdump():
                f.write(f'{line}\n')
        source_conn.close()
        
        # Создаем новую базу из дампа
        new_db_path = "database_new.db"
        new_conn = sqlite3.connect(new_db_path)
        with open(dump_file, 'r', encoding='utf-8') as f:
            new_conn.executescript(f.read())
        new_conn.close()
        
        # Заменяем старую базу новой
        os.remove(DB_PATH)
        os.rename(new_db_path, DB_PATH)
        os.remove(dump_file)
        
        print("База данных успешно восстановлена!")
        return True
        
    except Exception as e:
        print(f"Не удалось восстановить базу данных: {e}")
        print("Будет создана новая база данных.")
        # Удаляем поврежденную базу
        try:
            os.remove(DB_PATH)
        except:
            pass
        return True

def create_new_database():
    """Создает новую базу данных"""
    print("Создание новой базы данных...")
    
    # Удаляем старую базу, если она существует
    if os.path.exists(DB_PATH):
        try:
            # Пытаемся закрыть все соединения
            import sqlite3
            try:
                conn = sqlite3.connect(DB_PATH)
                conn.close()
            except:
                pass
            os.remove(DB_PATH)
            print(f"Удалена поврежденная база данных: {DB_PATH}")
        except PermissionError:
            print(f"ОШИБКА: Не удалось удалить {DB_PATH}")
            print("Пожалуйста, закройте все программы, использующие базу данных (сервер, IDE и т.д.)")
            print("Затем переименуйте файл вручную и запустите скрипт снова.")
            return False
        except Exception as e:
            print(f"Ошибка при удалении старой базы: {e}")
            return False
    
    # Импортируем модели и создаем структуру
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    
    try:
        from app.database import engine, Base
        from app import models
        
        # Создаем все таблицы
        Base.metadata.create_all(bind=engine)
        print("Новая база данных создана успешно!")
        print("ВНИМАНИЕ: Все данные были потеряны.")
        print("Используйте следующие скрипты для восстановления данных:")
        print("  - create_admin.py - создать администратора")
        print("  - create_departament_users.py - создать пользователей отделов")
        print("  - create_sample_stages.py - создать этапы строительства")
        print("  - migrate_cities.py - мигрировать города")
        return True
    except Exception as e:
        print(f"Ошибка при создании новой базы данных: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Восстановление базы данных")
    print("=" * 60)
    
    if try_repair_database():
        # Проверяем, нужно ли создавать новую базу
        if not os.path.exists(DB_PATH):
            create_new_database()
        else:
            # Проверяем целостность восстановленной базы
            try:
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("PRAGMA integrity_check")
                result = cursor.fetchone()
                conn.close()
                
                if result and result[0] == "ok":
                    print("База данных проверена и работает корректно!")
                else:
                    print("База данных все еще повреждена. Создаем новую...")
                    os.remove(DB_PATH)
                    create_new_database()
            except Exception as e:
                print(f"Ошибка при проверке базы: {e}")
                print("Создаем новую базу данных...")
                if not create_new_database():
                    return
    else:
        print("Не удалось восстановить базу данных. Создаем новую...")
        if not create_new_database():
            return
    
    print("=" * 60)
    print("Готово! Теперь можно запустить сервер.")
    print("=" * 60)
