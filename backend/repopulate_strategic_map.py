
from app.database import SessionLocal, engine
from app.models import StrategicMapProject, StrategicMapMilestone, City, Base
from sqlalchemy.orm import Session
import datetime

def repopulate():
    db: Session = SessionLocal()
    try:
        # 1. Clear existing data
        db.query(StrategicMapMilestone).delete()
        db.query(StrategicMapProject).delete()
        
        # 2. Get all existing cities
        cities = db.query(City).all()
        
        if not cities:
            print("No cities found in DB. Please create cities first.")
            return

        print(f"Found {len(cities)} cities. Creating strategic map entries...")

        # 3. Create projects based on cities
        # For each city, we'll create several rows (metrics) like in the Excel
        metrics = [
            "Площадь квартир, м2",
            "Стоимость квартир, руб/м2",
            "Выручка, тыс.руб.",
            "РНС (дата)",
            "Начало строительства (дата)",
            "Ввод (дата)",
            "Продажи (дата начала)"
        ]

        order = 0
        for city in cities:
            # Main row for the city (can be used as a header or just the first row)
            main_project = StrategicMapProject(
                city_id=city.id,
                name=city.name,
                order_index=order,
                is_subtotal=True # Make it look like a header
            )
            db.add(main_project)
            db.flush() # Get ID for parent_id
            
            parent_id = main_project.id
            order += 1
            
            for metric in metrics:
                metric_row = StrategicMapProject(
                    city_id=city.id,
                    name=f"  {metric}", # Indented name
                    order_index=order,
                    parent_group=city.name,
                    parent_id=parent_id
                )
                db.add(metric_row)
                order += 1
        
        db.commit()
        print("Successfully repopulated strategic map with database projects.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    repopulate()
