import sqlite3

conn = sqlite3.connect('database.db')
cursor = conn.cursor()

cursor.execute("SELECT id, username, email, role, hashed_password FROM users")
rows = cursor.fetchall()

with open('db_result.txt', 'w', encoding='utf-8') as f:
    f.write("=== All users in database ===\n")
    for row in rows:
        f.write(f"ID: {row[0]}, Username: {row[1]}, Email: {row[2]}, Role: {row[3]}\n")
        f.write(f"  Hash: {row[4]}\n\n")
    
    if not rows:
        f.write("No users found!\n")

conn.close()
print("Done - check db_result.txt")
