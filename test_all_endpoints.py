import requests

urls = [
    "http://localhost:8000/auth/test-login",
    "http://localhost:8000/api/auth/test-login",
    "http://localhost:8000/auth/login",
    "http://localhost:8000/api/auth/login",
]

data = {
    "username": "admin",
    "password": "admin123"
}

for url in urls:
    print(f"\nTrying: {url}")
    try:
        response = requests.post(url, data=data)
        print(f"  Status: {response.status_code}")
        if response.status_code < 500:
            print(f"  Response: {response.text[:200]}")
    except Exception as e:
        print(f"  Error: {e}")
