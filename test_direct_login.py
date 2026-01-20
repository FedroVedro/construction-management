import requests

url = "http://localhost:8000/api/auth/login"

# Test with form data
data = {
    "username": "admin",
    "password": "admin123"
}

print("Testing login endpoint...")
print(f"URL: {url}")
print(f"Data: {data}")

try:
    response = requests.post(url, data=data)
    print(f"\nStatus Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        print("\n SUCCESS! Login worked!")
        json_data = response.json()
        print(f"Token: {json_data.get('access_token', 'N/A')[:50]}...")
        print(f"User: {json_data.get('user', {})}")
    else:
        print("\n FAILED! Check backend logs")
except Exception as e:
    print(f"\n ERROR: {e}")
