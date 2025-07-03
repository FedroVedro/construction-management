"""
Скрипт для создания расширенного списка этапов строительства
Можно запустить после основной миграции для добавления дополнительных этапов
"""

from app.database import SessionLocal
from app import models

# Расширенный список этапов для разных типов строительства
additional_stages = [
    # Дополнительные этапы для жилых комплексов
    {"name": "Проектные изыскания", "description": "Геология, геодезия, экология", "order_index": 0},
    {"name": "Свайные работы", "description": "Забивка свай, устройство свайного поля", "order_index": 3},
    {"name": "Монолитные работы", "description": "Бетонирование перекрытий и стен", "order_index": 5},
    {"name": "Кирпичная кладка", "description": "Возведение кирпичных стен и перегородок", "order_index": 6},
    {"name": "Лифтовое оборудование", "description": "Монтаж и наладка лифтов", "order_index": 9},
    {"name": "Слаботочные системы", "description": "Видеонаблюдение, домофония, интернет", "order_index": 10},
    {"name": "Вентиляция и кондиционирование", "description": "Монтаж систем вентиляции", "order_index": 11},
    {"name": "Пожарная сигнализация", "description": "Установка систем пожарной безопасности", "order_index": 12},
    
    # Этапы для промышленных объектов
    {"name": "Металлоконструкции", "description": "Монтаж металлического каркаса", "order_index": 5},
    {"name": "Технологическое оборудование", "description": "Монтаж производственного оборудования", "order_index": 13},
    {"name": "Пусконаладочные работы", "description": "Настройка и запуск оборудования", "order_index": 14},
    
    # Дополнительные общие этапы
    {"name": "Временные сооружения", "description": "Бытовки, склады, ограждения", "order_index": 1},
    {"name": "Демонтажные работы", "description": "Снос старых конструкций", "order_index": 1},
    {"name": "Усиление конструкций", "description": "Укрепление существующих элементов", "order_index": 4},
    {"name": "Реставрационные работы", "description": "Восстановление исторических элементов", "order_index": 7},
    {"name": "Ландшафтный дизайн", "description": "Проектирование территории", "order_index": 11},
    {"name": "Малые архитектурные формы", "description": "Беседки, скамейки, урны", "order_index": 12},
    {"name": "Ввод в эксплуатацию", "description": "Получение разрешений и актов", "order_index": 13},
]

def create_additional_stages():
    db = SessionLocal()
    
    try:
        print("Добавление дополнительных этапов строительства...\n")
        
        created_count = 0
        skipped_count = 0
        
        for stage_data in additional_stages:
            # Проверяем существование
            existing = db.query(models.ConstructionStage).filter(
                models.ConstructionStage.name == stage_data["name"]
            ).first()
            
            if not existing:
                stage = models.ConstructionStage(**stage_data, is_active=True)
                db.add(stage)
                created_count += 1
                print(f"✓ Создан этап: {stage_data['name']}")
            else:
                skipped_count += 1
                print(f"- Пропущен (уже существует): {stage_data['name']}")
        
        db.commit()
        
        # Обновляем порядок сортировки
        print("\nОбновление порядка сортировки...")
        all_stages = db.query(models.ConstructionStage).order_by(
            models.ConstructionStage.order_index,
            models.ConstructionStage.name
        ).all()
        
        for index, stage in enumerate(all_stages):
            stage.order_index = index
        
        db.commit()
        
        print(f"\n✅ Готово!")
        print(f"   Создано новых этапов: {created_count}")
        print(f"   Пропущено существующих: {skipped_count}")
        print(f"   Всего этапов в системе: {len(all_stages)}")
        
    except Exception as e:
        print(f"\n❌ Ошибка: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_additional_stages()