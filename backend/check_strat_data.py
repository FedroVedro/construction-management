from app.database import SessionLocal
from app import models

db = SessionLocal()
print("--- STRATEGIC MAP DATA ---")
projects_count = db.query(models.StrategicMapProject).count()
milestones_count = db.query(models.StrategicMapMilestone).count()
print(f"Projects: {projects_count}")
print(f"Milestones: {milestones_count}")
db.close()
