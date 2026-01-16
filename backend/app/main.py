from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import models
from .database import engine
from .routers import auth, users, cities, schedules, dashboard, construction_stages, project_office, strategic_map

# Создание таблиц
models.Base.metadata.create_all(bind=engine)

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

@app.get("/")
def read_root():
    return {"message": "Construction Management API"}