from app.database import SessionLocal
from app import models

db = SessionLocal()

# Get all users
users = db.query(models.User).all()

print(f"Total users in database: {len(users)}")
print("\nUsers:")
for user in users:
    print(f"  ID: {user.id}")
    print(f"  Username: {user.username}")
    print(f"  Email: {user.email}")
    print(f"  Role: {user.role}")
    print(f"  Hashed password: {user.hashed_password[:50]}...")
    print(f"  Created at: {user.created_at}")
    print()

db.close()
