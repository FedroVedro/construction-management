from app import auth
from app.database import SessionLocal
from app import models

# Test password hashing
password = "admin123"
print(f"Testing password: {password}")

# Hash the password
hashed = auth.get_password_hash(password)
print(f"Hashed password: {hashed}")

# Verify the password
is_valid = auth.verify_password(password, hashed)
print(f"Password verification: {is_valid}")

# Check admin user in database
db = SessionLocal()
admin = db.query(models.User).filter(models.User.username == "admin").first()

if admin:
    print(f"\nAdmin user found:")
    print(f"  Username: {admin.username}")
    print(f"  Email: {admin.email}")
    print(f"  Role: {admin.role}")
    print(f"  Hashed password: {admin.hashed_password}")
    
    # Test verification with database hash
    is_valid_db = auth.verify_password(password, admin.hashed_password)
    print(f"  Verification with DB hash: {is_valid_db}")
    
    # Test with wrong password
    is_valid_wrong = auth.verify_password("wrongpassword", admin.hashed_password)
    print(f"  Verification with wrong password: {is_valid_wrong}")
else:
    print("\nAdmin user not found in database!")

db.close()
