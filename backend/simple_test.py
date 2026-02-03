with open('d:/Job/Projects/construction-management/backend/test_output.txt', 'w') as f:
    f.write('Python is working!\n')
    
    try:
        import bcrypt
        f.write('bcrypt imported OK\n')
    except Exception as e:
        f.write(f'bcrypt import error: {e}\n')
    
    try:
        import sqlite3
        conn = sqlite3.connect('d:/Job/Projects/construction-management/backend/database.db')
        cursor = conn.cursor()
        cursor.execute("SELECT count(*) FROM users")
        count = cursor.fetchone()[0]
        f.write(f'Users in database: {count}\n')
        
        cursor.execute("SELECT username, hashed_password FROM users")
        for row in cursor.fetchall():
            f.write(f'User: {row[0]}, Hash: {row[1][:30]}...\n')
        conn.close()
    except Exception as e:
        f.write(f'Database error: {e}\n')
