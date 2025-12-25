from app.database import SessionLocal, engine
from app import models, auth

# Create tables
models.Base.metadata.create_all(bind=engine)

# Create admin user
db = SessionLocal()

# Удаляем существующего администратора если есть
existing_admin = db.query(models.User).filter(models.User.username == "admin").first()
if existing_admin:
    print("Удаляем существующего администратора...")
    db.delete(existing_admin)
    db.commit()

# Создаем нового администратора с правильным паролем
print("Создаем нового администратора...")
admin_user = models.User(
    username="admin",
    email="admin@construction.com",
    hashed_password=auth.get_password_hash("admin123"),
    role="admin"
)

db.add(admin_user)
db.commit()

# Проверяем пароль
test_password = "admin123"
is_valid = auth.verify_password(test_password, admin_user.hashed_password)

print("\n" + "="*50)
print("Администратор создан!")
print("="*50)
print(f"Имя пользователя: admin")
print(f"Пароль: admin123")
if is_valid:
    print("Проверка пароля: OK - Пароль работает!")
else:
    print("Проверка пароля: ERROR - Ошибка проверки пароля")
print("="*50)

db.close()

