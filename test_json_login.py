import requests
import json

url = "http://localhost:8000/api/auth/login-json"

data = {
    "username": "admin",
    "password": "admin123"
}

print("Testing JSON login endpoint...")
try:
    response = requests.post(url, json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 200:
        print("\n✅ SUCCESS!")
        token_data = response.json()
        print(f"Token: {token_data.get('access_token', 'N/A')[:50]}...")
    else:
        print("\n❌ FAILED!")
except Exception as e:
    print(f"Error: {e}")
