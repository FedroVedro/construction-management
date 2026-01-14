"""
Скрипт импорта данных из Excel файла Мастер_карта_развития_26_12_25_корр.xlsx
в базу данных мастер-карты стратегического развития
"""

import pandas as pd
import openpyxl
from datetime import datetime
from sqlalchemy.orm import Session

# Настройка пути
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine
from app.models import StrategicMapProject, StrategicMapMilestone, City, Base

# Создаём таблицы если их нет
Base.metadata.create_all(bind=engine)

# Путь к Excel файлу
EXCEL_PATH = r'D:\Job\Projects\construction-management\Мастер_карта_развития_26_12_25_корр.xlsx'

# Сопоставление типов вех на основе анализа данных
MILESTONE_TYPE_MAPPING = {
    'рнс': 'РНС',
    'продаж': 'Продажа',
    'строит': 'Строительство',
    'проект': 'Проектирование',
    'соглас': 'Согласование',
    'заверш': 'Завершение',
    'подгот': 'Подготовка',
    'окончан': 'Завершение',
    'нач': 'Строительство',
}

def detect_milestone_type(value):
    """Определяет тип вехи по значению"""
    if not value or pd.isna(value):
        return None
    
    value_lower = str(value).lower()
    for key, milestone_type in MILESTONE_TYPE_MAPPING.items():
        if key in value_lower:
            return milestone_type
    
    # Если это число, то скорее всего это строительство/площадь
    try:
        float(value)
        return 'Строительство'
    except:
        pass
    
    return None


def import_from_excel():
    """Импортирует данные из Excel в базу данных"""
    
    db: Session = SessionLocal()
    
    try:
        # Загружаем Excel
        wb = openpyxl.load_workbook(EXCEL_PATH)
        
        # Получаем существующие города
        cities = {c.name.lower(): c.id for c in db.query(City).all()}
        
        print("=" * 60)
        print("ИМПОРТ МАСТЕР-КАРТЫ СТРАТЕГИЧЕСКОГО РАЗВИТИЯ")
        print("=" * 60)
        
        # Обрабатываем листы
        for sheet_name in wb.sheetnames:
            print(f"\nОбработка листа: {sheet_name}")
            
            ws = wb[sheet_name]
            
            # Читаем данные через pandas для удобства
            df = pd.read_excel(EXCEL_PATH, sheet_name=sheet_name, header=None)
            
            if df.empty or df.shape[0] < 4:
                print(f"  Пропускаем пустой лист")
                continue
            
            # Определяем структуру:
            # Строка 0-2: заголовки (кварталы, месяцы, номера)
            # Строка 3+: данные проектов
            
            # Парсим месяцы из строки 1 (даты)
            month_columns = {}  # колонка -> дата
            for col_idx in range(5, df.shape[1]):
                val = df.iloc[1, col_idx] if 1 < df.shape[0] else None
                if pd.notna(val):
                    try:
                        if isinstance(val, datetime):
                            month_columns[col_idx] = val
                        elif isinstance(val, str):
                            month_columns[col_idx] = pd.to_datetime(val)
                    except:
                        pass
            
            print(f"  Найдено {len(month_columns)} месяцев в таймлайне")
            
            # Обрабатываем строки проектов (начиная с 3-й)
            project_count = 0
            for row_idx in range(3, min(df.shape[0], 25)):  # Ограничиваем количество
                row = df.iloc[row_idx]
                
                # Первый столбец - название проекта
                project_name = row.iloc[0] if pd.notna(row.iloc[0]) else None
                
                if not project_name or pd.isna(project_name):
                    continue
                
                project_name = str(project_name).strip()
                
                # Пропускаем строки "Итого", "Всего" и т.д.
                if any(skip in project_name.lower() for skip in ['итого', 'всего', 'nan', 'нарастающим']):
                    # Создаём как подытог
                    is_subtotal = 'подытог' in project_name.lower() or 'итого' in project_name.lower()
                    is_total = 'всего' in project_name.lower()
                    
                    if is_subtotal or is_total:
                        project = StrategicMapProject(
                            name=project_name,
                            is_subtotal=is_subtotal,
                            is_total=is_total,
                            order_index=row_idx,
                            parent_group=sheet_name
                        )
                        db.add(project)
                    continue
                
                # Парсим числовые поля
                planned_area = None
                total_area = None
                floors = None
                construction_duration = None
                
                try:
                    if pd.notna(row.iloc[1]):
                        planned_area = float(row.iloc[1])
                except:
                    pass
                
                try:
                    if pd.notna(row.iloc[2]):
                        total_area = float(row.iloc[2])
                except:
                    pass
                
                try:
                    if pd.notna(row.iloc[3]):
                        floors = int(row.iloc[3])
                except:
                    pass
                
                try:
                    if pd.notna(row.iloc[4]):
                        construction_duration = int(row.iloc[4])
                except:
                    pass
                
                # Пробуем привязать к городу
                city_id = None
                for city_name, cid in cities.items():
                    if city_name in project_name.lower():
                        city_id = cid
                        break
                
                # Создаём проект
                project = StrategicMapProject(
                    city_id=city_id,
                    name=project_name,
                    planned_area=planned_area,
                    total_area=total_area,
                    floors=floors,
                    construction_duration=construction_duration,
                    order_index=row_idx,
                    parent_group=sheet_name
                )
                db.add(project)
                db.flush()  # Получаем ID
                
                # Добавляем вехи
                milestone_count = 0
                for col_idx, month_date in month_columns.items():
                    if col_idx < df.shape[1]:
                        value = row.iloc[col_idx]
                        if pd.notna(value) and str(value).strip():
                            value_str = str(value).strip()
                            milestone_type = detect_milestone_type(value_str)
                            
                            # Определяем ключевая ли веха
                            is_key = milestone_type in ['РНС', 'Завершение']
                            
                            milestone = StrategicMapMilestone(
                                project_id=project.id,
                                month_date=month_date,
                                milestone_type=milestone_type,
                                value=value_str[:100],  # Ограничиваем длину
                                is_key_milestone=is_key
                            )
                            db.add(milestone)
                            milestone_count += 1
                
                project_count += 1
                print(f"  + {project_name}: {milestone_count} вех")
            
            print(f"  Импортировано проектов: {project_count}")
        
        db.commit()
        print("\n" + "=" * 60)
        print("ИМПОРТ ЗАВЕРШЁН УСПЕШНО!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\nОШИБКА: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


def clear_strategic_map_data():
    """Очищает все данные мастер-карты"""
    db: Session = SessionLocal()
    try:
        db.query(StrategicMapMilestone).delete()
        db.query(StrategicMapProject).delete()
        db.commit()
        print("Данные мастер-карты очищены")
    finally:
        db.close()


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Импорт мастер-карты из Excel')
    parser.add_argument('--clear', action='store_true', help='Очистить существующие данные перед импортом')
    
    args = parser.parse_args()
    
    if args.clear:
        clear_strategic_map_data()
    
    import_from_excel()
