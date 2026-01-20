from app.database import SessionLocal
from app import models, auth

db = SessionLocal()

# Find admin user
admin = db.query(models.User).filter(models.User.username == "admin").first()

if admin:
    # Update password
    new_password = "admin123"
    admin.hashed_password = auth.get_password_hash(new_password)
    db.commit()
    print("Admin password has been reset successfully!")
    print(f"Username: admin")
    print(f"Password: {new_password}")
else:
    print("Admin user not found!")
    print("Creating new admin user...")
    
    admin_user = models.User(
        username="admin",
        email="admin@construction.com",
        hashed_password=auth.get_password_hash("admin123"),
        role="admin"
    )
    
    db.add(admin_user)
    db.commit()
    
    print("Admin user created!")
    print("Username: admin")
    print("Password: admin123")

db.close()
