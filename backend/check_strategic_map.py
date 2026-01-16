from app.database import SessionLocal
from app import models

db = SessionLocal()

print("="*50)
print("Strategic Map Projects")
print("="*50)
projects = db.query(models.StrategicMapProject).all()
print(f"Total Projects: {len(projects)}")
for p in projects:
    print(f"ID: {p.id} | Name: {p.name} | CityID: {p.city_id} | ParentID: {p.parent_id}")
    print(f"  Milestones: {len(p.milestones)}")

print("\n" + "="*50)
print("Strategic Map Milestones")
print("="*50)
milestones = db.query(models.StrategicMapMilestone).all()
print(f"Total Milestones: {len(milestones)}")
for m in milestones[:10]:
    print(f"ID: {m.id} | ProjectID: {m.project_id} | Date: {m.month_date} | Type: {m.milestone_type}")

db.close()
