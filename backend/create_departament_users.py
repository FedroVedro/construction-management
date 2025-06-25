from app.database import SessionLocal, engine
from app import models, auth

# Список пользователей для создания
department_users = [
    {
        "username": "doc_user",
        "email": "doc@construction.com",
        "password": "doc123",
        "role": "department_user",
        "department": "Отдел документации"
    },
    {
        "username": "hr_user",
        "email": "hr@construction.com",
        "password": "hr123",
        "role": "department_user",
        "department": "HR отдел"
    },
    {
        "username": "procurement_user",
        "email": "procurement@construction.com",
        "password": "proc123",
        "role": "department_user",
        "department": "Отдел закупок"
    },
    {
        "username": "construction_user",
        "email": "construction@construction.com",
        "password": "const123",
        "role": "department_user",
        "department": "Строительный отдел"
    },
    {
        "username": "director",
        "email": "director@construction.com",
        "password": "dir123",
        "role": "director",
        "department": "Дирекция"
    }
]

# Создаем сессию БД
db = SessionLocal()

print("Создание пользователей по отделам...\n")

for user_data in department_users:
    # Проверяем, существует ли пользователь
    existing_user = db.query(models.User).filter(
        models.User.username == user_data["username"]
    ).first()
    
    if existing_user:
        print(f"❌ Пользователь {user_data['username']} уже существует")
    else:
        # Создаем нового пользователя
        new_user = models.User(
            username=user_data["username"],
            email=user_data["email"],
            hashed_password=auth.get_password_hash(user_data["password"]),
            role=user_data["role"],
            department=user_data["department"]
        )
        
        db.add(new_user)
        db.commit()
        
        print(f"✅ Создан пользователь:")
        print(f"   Логин: {user_data['username']}")
        print(f"   Пароль: {user_data['password']}")
        print(f"   Роль: {user_data['role']}")
        print(f"   Отдел: {user_data['department']}")
        print()

print("\n⚠️  ВАЖНО: Смените пароли после первого входа!")

db.close()