import requests
import os

BASE_URL = "http://127.0.0.1:5000"

def upload_file(filepath):
    url = f"{BASE_URL}/upload"
    files = {'pdf_file': open(filepath, 'rb')}
    print(f"Uploading {filepath}...")
    response = requests.post(url, files=files)
    print(f"Upload Status: {response.status_code}")
    # The app redirects to /editor/<filename> or /
    # check history or filename logic
    if response.status_code == 200 or response.status_code == 302:
        return os.path.basename(filepath)
    return None

def test_compare():
    file1 = "base.pdf"
    file2 = "diff.pdf"
    
    # Upload first
    upload_file(f"tests/resources/{file1}")
    upload_file(f"tests/resources/{file2}")
    
    # Compare
    url = f"{BASE_URL}/compare"
    data = {
        "filename1": file1,
        "filename2": file2
    }
    print(f"Comparing {file1} and {file2}...")
    try:
        response = requests.post(url, json=data)
        print(f"Compare Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 200:
            print("SUCCESS: Comparison worked")
        else:
            print("FAILURE: Comparison failed")
    except Exception as e:
        print(f"CRASH: {e}")

if __name__ == "__main__":
    test_compare()
