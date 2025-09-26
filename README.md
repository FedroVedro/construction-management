# Система управления строительством

## Требования
- Python 3.11
- Node.js 16+
- npm или yarn

## Установка и запуск

### Backend (FastAPI)

1. Откройте командную строку (cmd) или PowerShell
2. Перейдите в папку с backend:
```bash
cd backend
```

3. Создайте виртуальное окружение:
```bash
python -m venv venv
```

4. Активируйте виртуальное окружение:
```bash
# PowerShell
venv\Scripts\Activate.ps1

# или cmd
venv\Scripts\activate.bat
```

5. Установите зависимости:
```bash
pip install -r requirements.txt
```

6. Создайте администратора:
```bash
python create_admin.py
```
Логин: `admin`  
Пароль: `admin123`

7. Запустите сервер:
```bash
uvicorn app.main:app --reload --port 8000
```

Backend будет доступен по адресу: http://localhost:8000

### Frontend (React)

1. Откройте новое окно командной строки
2. Перейдите в папку с frontend:
```bash
cd frontend
```

3. Установите зависимости:
```bash
npm install
```

4. Запустите приложение:
```bash
npm start
```

Frontend будет доступен по адресу: http://localhost:3000

## Использование

1. Откройте браузер и перейдите на http://localhost:3000
2. Войдите с учетными данными администратора
3. Начните работу с системой

## Роли пользователей

- **admin** - полный доступ ко всем функциям
- **director** - только просмотр графиков и отчетов
- **department_user** - создание и редактирование графиков своего отдела