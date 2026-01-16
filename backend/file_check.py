import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from app.database import SessionLocal
    from app import models
    
    output_file = r"d:\Job\Projects\construction-management\db_check_result.txt"
    
    with open(output_file, "w", encoding="utf-8") as f:
        db = SessionLocal()
        try:
            f.write("--- DB CHECK START ---\n")
            
            # Check Admin
            admin = db.query(models.User).filter(models.User.username == "admin").first()
            if admin:
                f.write(f"ADMIN: Found (ID: {admin.id}, Role: {admin.role})\n")
            else:
                f.write("ADMIN: NOT FOUND\n")

            # Check Tables
            f.write(f"Users: {db.query(models.User).count()}\n")
            f.write(f"Cities: {db.query(models.City).count()}\n")
            f.write(f"Stages: {db.query(models.ConstructionStage).count()}\n")
            f.write(f"Schedules: {db.query(models.Schedule).count()}\n")
            f.write(f"Strategic Projects: {db.query(models.StrategicMapProject).count()}\n")
            f.write(f"Strategic Milestones: {db.query(models.StrategicMapMilestone).count()}\n")
            
            f.write("--- DB CHECK END ---\n")
        except Exception as e:
            f.write(f"DB CHECK ERROR: {e}\n")
        finally:
            db.close()
            
except Exception as e:
    # If we can't write to the file, try to exit with error code
    print(f"CRITICAL ERROR: {e}")
    sys.exit(1)
