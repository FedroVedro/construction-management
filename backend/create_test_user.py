from app.database import SessionLocal
from app import models, auth

db = SessionLocal()

# Delete existing test user if exists
test_user = db.query(models.User).filter(models.User.username == "testuser").first()
if test_user:
    db.delete(test_user)
    db.commit()
    print("Deleted existing test user")

# Create new test user
test_user = models.User(
    username="testuser",
    email="test@test.com",
    hashed_password=auth.get_password_hash("test123"),
    role="admin"
)

db.add(test_user)
db.commit()

print("Test user created successfully!")
print("Username: testuser")
print("Password: test123")

# Verify the password works
print("\nVerifying password...")
is_valid = auth.verify_password("test123", test_user.hashed_password)
print(f"Password verification: {is_valid}")

db.close()
