from app.database import SessionLocal, engine
from app import models, auth

# Create tables
models.Base.metadata.create_all(bind=engine)

# Create admin user
db = SessionLocal()

admin_user = models.User(
    username="admin",
    email="admin@construction.com",
    hashed_password=auth.get_password_hash("admin123"),
    role="admin"
)

db.add(admin_user)
db.commit()
db.close()

print("Admin user created successfully!")
print("Username: admin")
print("Password: admin123")