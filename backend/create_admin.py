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

# Создаем примеры объектов строительства если их нет
existing_cities = db.query(models.City).count()
if existing_cities == 0:
    print("\nСоздаем примеры объектов строительства...")
    
    sample_cities = [
        {
            "name": "ЖК Солнечный",
            "description": "Жилой комплекс на 500 квартир с подземной парковкой и детской площадкой"
        },
        {
            "name": "Бизнес-центр Горизонт",
            "description": "15-этажный бизнес-центр класса А с общей площадью 25000 кв.м"
        },
        {
            "name": "ТРЦ Мегаполис",
            "description": "Торгово-развлекательный центр с кинотеатром и фуд-кортом"
        }
    ]
    
    for city_data in sample_cities:
        city = models.City(**city_data)
        db.add(city)
    
    db.commit()
    print("Примеры объектов строительства созданы!")

db.close()