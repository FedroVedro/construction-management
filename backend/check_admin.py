from app.database import SessionLocal
from app import models, auth

output_lines = []

db = SessionLocal()

# Check if admin exists
user = db.query(models.User).filter(models.User.username == "admin").first()

if user:
    output_lines.append("=== Admin user found ===")
    output_lines.append(f"ID: {user.id}")
    output_lines.append(f"Username: {user.username}")
    output_lines.append(f"Email: {user.email}")
    output_lines.append(f"Role: {user.role}")
    output_lines.append(f"Hash: {user.hashed_password}")
    output_lines.append(f"Hash starts with $2: {user.hashed_password.startswith('$2') if user.hashed_password else False}")
    
    # Test password verification
    test_password = "admin123"
    try:
        result = auth.verify_password(test_password, user.hashed_password)
        output_lines.append(f"Password 'admin123' verification: {result}")
    except Exception as e:
        output_lines.append(f"Password verification error: {e}")
else:
    output_lines.append("Admin user NOT found in database!")
    output_lines.append("All users in database:")
    users = db.query(models.User).all()
    for u in users:
        output_lines.append(f"  - {u.username} (role: {u.role})")

db.close()

# Write to file
with open('check_result.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output_lines))
