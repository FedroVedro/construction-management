from app.database import engine
from sqlalchemy import text


REQUIRED_COLUMNS = {
    'id': 'INTEGER PRIMARY KEY',
    'city_id': 'INTEGER NOT NULL',
    'set_date': 'DATETIME',
    'initiator': 'VARCHAR(255)',
    'task': 'TEXT',
    'work_name': 'VARCHAR(255)',
    'responsible': 'VARCHAR(255)',
    'participants': 'TEXT',
    'due_date': 'TEXT',
    'status': 'VARCHAR(50)',
    'completion_date': 'DATETIME',
    'delay_reason': 'TEXT',
    'comments': 'TEXT',
    'is_done': 'BOOLEAN DEFAULT 0',
    'result': 'TEXT',
    'text_color': 'VARCHAR(20)',
    'created_at': 'DATETIME',
    'updated_at': 'DATETIME'
}


def get_existing_columns(conn):
    result = conn.execute(text("PRAGMA table_info(project_office_tasks)"))
    return {row[1] for row in result.fetchall()}


def create_table_if_not_exists(conn):
    # SQLite supports IF NOT EXISTS for CREATE TABLE
    columns_sql = ",\n        ".join([f"{name} {ctype}" for name, ctype in REQUIRED_COLUMNS.items()])
    create_sql = f"""
    CREATE TABLE IF NOT EXISTS project_office_tasks (
        {columns_sql}
    )
    """
    conn.execute(text(create_sql))


def add_missing_columns(conn, existing_columns):
    for name, ctype in REQUIRED_COLUMNS.items():
        if name not in existing_columns:
            alter_sql = f"ALTER TABLE project_office_tasks ADD COLUMN {name} {ctype}"
            conn.execute(text(alter_sql))


def ensure_indexes(conn):
    # helpful index by city
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_pot_city_id ON project_office_tasks(city_id)"))


def main():
    with engine.begin() as conn:
        create_table_if_not_exists(conn)
        existing = get_existing_columns(conn)
        add_missing_columns(conn, existing)
        ensure_indexes(conn)
    print("project_office_tasks table is up to date.")


if __name__ == "__main__":
    main()


