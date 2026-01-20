import requests

url = "http://localhost:8000/api/auth/login"

data = {
    "username": "testuser",
    "password": "test123"
}

print("Testing login with testuser...")
try:
    response = requests.post(url, data=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:300]}")
    
    if response.status_code == 200:
        print("\n SUCCESS!")
    else:
        print("\n FAILED!")
except Exception as e:
    print(f"Error: {e}")
