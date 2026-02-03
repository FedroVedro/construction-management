from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import models, auth as auth_module
from .database import engine, SessionLocal
from .routers import auth, users, cities, schedules, dashboard, construction_stages, project_office, strategic_map, process_management, dependencies

# Создание таблиц
models.Base.metadata.create_all(bind=engine)

# Инициализация admin пользователя при запуске (использует raw SQL для совместимости)
def init_admin_user():
    import sqlite3
    try:
        conn = sqlite3.connect('database.db')
        cursor = conn.cursor()
        
        # Проверяем и добавляем все недостающие колонки в таблице users
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        
        missing_columns = {
            'permissions': 'TEXT',
            'created_at': 'DATETIME',
            'updated_at': 'DATETIME',
            'is_active': 'BOOLEAN DEFAULT 1',
            'department': 'TEXT'
        }
        
        for col_name, col_type in missing_columns.items():
            if col_name not in columns:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
                print(f"Added '{col_name}' column to users table")
        
        conn.commit()
        
        # Проверяем существует ли admin
        cursor.execute("SELECT id FROM users WHERE username = 'admin'")
        admin = cursor.fetchone()
        
        # Генерируем хеш пароля
        password_hash = auth_module.get_password_hash("admin123")
        
        if not admin:
            cursor.execute(
                "INSERT INTO users (username, email, hashed_password, role, is_active) VALUES (?, ?, ?, ?, ?)",
                ('admin', 'admin@construction.com', password_hash, 'admin', 1)
            )
            print("Admin user created: admin / admin123")
        else:
            cursor.execute(
                "UPDATE users SET hashed_password = ?, is_active = 1 WHERE username = 'admin'",
                (password_hash,)
            )
            print("Admin user password reset: admin / admin123")
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error initializing admin: {e}")

init_admin_user()

app = FastAPI(title="Construction Management API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(cities.router, prefix="/api/cities", tags=["cities"])
app.include_router(construction_stages.router, prefix="/api/construction-stages", tags=["construction_stages"])
app.include_router(schedules.router, prefix="/api/schedules", tags=["schedules"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(project_office.router, prefix="/api/project-office", tags=["project_office"])
app.include_router(strategic_map.router, prefix="/api", tags=["strategic_map"])
app.include_router(process_management.router, prefix="/api/process-management", tags=["process_management"])
app.include_router(dependencies.router, prefix="/api/dependencies", tags=["dependencies"])

@app.get("/")
def read_root():
    return {"message": "Construction Management API"}