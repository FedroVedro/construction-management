"""
Migration script to add permissions column to users table
"""
import sqlite3

conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Check if column exists
cursor.execute("PRAGMA table_info(users)")
columns = [col[1] for col in cursor.fetchall()]

if 'permissions' not in columns:
    cursor.execute("ALTER TABLE users ADD COLUMN permissions TEXT")
    conn.commit()
    print("Added 'permissions' column to users table")
else:
    print("Column 'permissions' already exists")

conn.close()
