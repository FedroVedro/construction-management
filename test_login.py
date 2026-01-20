import requests
import json

# Тест логина
url = "http://localhost:8000/api/auth/login"
data = {
    "username": "admin",
    "password": "admin123"
}

print("=== Testing login with form-data ===")
try:
    response = requests.post(url, data=data)  # Use data= for form-data
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    if response.status_code == 200:
        token = response.json().get("access_token")
        print(f"Token received: {token[:50]}...")
except Exception as e:
    print(f"Error: {e}")

# Тест получения городов
print("\n--- Testing cities endpoint ---")
try:
    cities_response = requests.get("http://localhost:8000/api/cities")
    print(f"Cities Status Code: {cities_response.status_code}")
    if cities_response.status_code == 200:
        cities = cities_response.json()
        print(f"Cities count: {len(cities)}")
        if cities:
            print(f"First city: {json.dumps(cities[0], indent=2, ensure_ascii=False)}")
except Exception as e:
    print(f"Cities Error: {e}")
