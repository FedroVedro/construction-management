from app.database import SessionLocal, engine
from app import models, auth

# Create tables
models.Base.metadata.create_all(bind=engine)

# Create admin user
db = SessionLocal()

# Check if admin already exists
existing_admin = db.query(models.User).filter(models.User.username == "admin").first()
if existing_admin:
    print("Admin user already exists!")
else:
    admin_user = models.User(
        username="admin",
        email="admin@construction.com",
        hashed_password=auth.get_password_hash("admin123"),
        role="admin"
    )
    
    db.add(admin_user)
    db.commit()
    
    print("Admin user created successfully!")
    print("Username: admin")
    print("Password: admin123")
    print("\nПожалуйста, смените пароль после первого входа!")

db.close()