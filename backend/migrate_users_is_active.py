import os
import sqlite3

def main():
    db_path = os.path.join(os.path.dirname(__file__), "database.db")
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"DB not found: {db_path}")

    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(users)")
        columns = {row[1] for row in cur.fetchall()}
        if "is_active" not in columns:
            cur.execute("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1")
            conn.commit()
            print("Added users.is_active column.")
        else:
            print("users.is_active already exists.")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
