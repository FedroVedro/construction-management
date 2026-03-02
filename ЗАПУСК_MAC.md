# Запуск на macOS

## Требования

- **Python 3.10+** — проверить: `python3 --version`
- **Node.js 16+** — проверить: `node --version`
- **npm** — проверить: `npm --version`

Если Python или Node.js не установлены, установите через [Homebrew](https://brew.sh):

```bash
brew install python@3.11 node
```

---

## 1. Клонирование репозитория

```bash
git clone <URL-репозитория>
cd construction-management
```

Если проект уже скачан — просто откройте терминал и перейдите в папку проекта.

---

## 2. Запуск бэкенда (FastAPI)

Откройте терминал и выполните команды по порядку:

```bash
cd backend
```

### Создание виртуального окружения (только при первом запуске)

```bash
python3 -m venv venv
```

### Активация виртуального окружения

```bash
source venv/bin/activate
```

После активации в начале строки терминала появится `(venv)`.

### Установка зависимостей (только при первом запуске)

```bash
pip install -r requirements.txt
```

### Создание администратора (только при первом запуске)

```bash
python create_admin.py
```

Будет создан пользователь:
- **Логин:** `admin`
- **Пароль:** `admin123`

### Запуск сервера

```bash
uvicorn app.main:app --reload --port 8000
```

Бэкенд будет доступен по адресу: http://localhost:8000
Документация API (Swagger): http://localhost:8000/docs

> Не закрывайте это окно терминала — сервер работает, пока оно открыто.

---

## 3. Запуск фронтенда (React)

Откройте **новое** окно терминала (Cmd+T или Cmd+N) и выполните:

```bash
cd frontend
```

### Установка зависимостей (только при первом запуске)

```bash
npm install
```

### Запуск приложения

```bash
npm start
```

Фронтенд будет доступен по адресу: http://localhost:3000
Браузер откроется автоматически.

---

## 4. Использование

1. Откройте http://localhost:3000 в браузере
2. Введите логин `admin` и пароль `admin123`
3. Готово — можно работать

### Роли пользователей

| Роль | Доступ |
|------|--------|
| `admin` | Полный доступ ко всем функциям |
| `director` | Только просмотр графиков и отчётов |
| `department_user` | Создание и редактирование графиков своего отдела |

---

## 5. Повторный запуск (когда всё уже установлено)

Достаточно двух команд в двух окнах терминала:

**Терминал 1 — бэкенд:**

```bash
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000
```

**Терминал 2 — фронтенд:**

```bash
cd frontend && npm start
```

---

## Остановка серверов

В каждом окне терминала нажмите `Ctrl+C`.

---

## Возможные проблемы

### `command not found: python3`

Python не установлен. Установите через Homebrew:

```bash
brew install python@3.11
```

### `command not found: node` или `command not found: npm`

Node.js не установлен. Установите через Homebrew:

```bash
brew install node
```

### `ERROR: No matching distribution found`

Возможно, версия Python слишком старая. Убедитесь, что используется Python 3.10+:

```bash
python3 --version
```

### `EACCES: permission denied`

Не хватает прав на запись в папку `node_modules`. Исправить:

```bash
sudo chown -R $(whoami) frontend/node_modules
```

### Порт 8000 или 3000 уже занят

Найдите и завершите процесс, занимающий порт:

```bash
lsof -i :8000
kill -9 <PID>
```

Замените `8000` на `3000` для фронтенда.
