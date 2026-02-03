"""
Script to reset/create admin user with proper bcrypt password hash
"""
import sqlite3
import bcrypt

output = []

try:
    # Connect directly to SQLite database
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()

    # Check current state of admin user
    cursor.execute("SELECT id, username, hashed_password FROM users WHERE username = 'admin'")
    admin = cursor.fetchone()

    # Generate new bcrypt hash for password 'admin123'
    password = "admin123"
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    hashed_str = hashed.decode('utf-8')

    if admin:
        # Update existing admin password
        cursor.execute(
            "UPDATE users SET hashed_password = ? WHERE username = 'admin'",
            (hashed_str,)
        )
        output.append(f"Admin user updated!")
        output.append(f"Old hash: {admin[2]}")
    else:
        # Create new admin user
        cursor.execute(
            "INSERT INTO users (username, email, hashed_password, role, is_active) VALUES (?, ?, ?, ?, ?)",
            ('admin', 'admin@construction.com', hashed_str, 'admin', 1)
        )
        output.append("Admin user created!")

    conn.commit()

    # Verify the update
    cursor.execute("SELECT id, username, email, role, hashed_password FROM users WHERE username = 'admin'")
    admin = cursor.fetchone()
    output.append(f"=== Admin user info ===")
    output.append(f"ID: {admin[0]}")
    output.append(f"Username: {admin[1]}")
    output.append(f"Email: {admin[2]}")
    output.append(f"Role: {admin[3]}")
    output.append(f"New hash: {admin[4]}")
    output.append(f"Password: admin123")

    # Verify password works
    stored_hash = admin[4].encode('utf-8')
    test_result = bcrypt.checkpw(password.encode('utf-8'), stored_hash)
    output.append(f"Password verification test: {test_result}")

    conn.close()
    output.append("SUCCESS")
except Exception as e:
    output.append(f"ERROR: {e}")

# Write to file
with open('reset_result.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))
