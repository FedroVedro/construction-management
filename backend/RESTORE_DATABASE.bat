@echo off
chcp 65001 >nul
echo ================================================
echo Восстановление базы данных
echo ================================================
echo.

if exist database.db (
    echo Удаление старой базы данных...
    del database.db
    echo Старая база удалена
)

echo.
echo Создание новой базы данных...
python -c "from app.database import SessionLocal, engine; from app import models, auth; models.Base.metadata.create_all(bind=engine); db = SessionLocal(); admin = models.User(username='admin', email='admin@construction.com', hashed_password=auth.get_password_hash('admin123'), role='admin'); db.add(admin); db.add(models.City(name='ЖК Солнечный', description='Жилой комплекс')); db.add(models.City(name='Бизнес-центр Горизонт', description='Бизнес-центр')); db.add(models.City(name='ТРЦ Мегаполис', description='ТРЦ')); db.commit(); db.close(); print('База данных создана!')"

echo.
echo ================================================
echo База данных восстановлена!
echo ================================================
echo.
echo Учетные данные администратора:
echo   Username: admin
echo   Password: admin123
echo ================================================
echo.
pause
