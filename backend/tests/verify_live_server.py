import threading
import time
import requests
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app import create_app
from werkzeug.serving import make_server

class ServerThread(threading.Thread):
    def __init__(self, app, port=5000):
        super().__init__()
        self.server = make_server("127.0.0.1", port, app)
        self.ctx = app.app_context()
        self.ctx.push()

    def run(self):
        self.server.serve_forever()

    def shutdown(self):
        self.server.shutdown()

def test_live_server():
    print(">>> Starting live Flask test server on 127.0.0.1:5000...")
    app = create_app("testing")
    server = ServerThread(app, port=5000)
    server.start()
    time.sleep(1)

    try:
        # 1. Probe Health Endpoint
        health_url = "http://127.0.0.1:5000/api/health"
        print(f"Testing GET {health_url}...")
        resp = requests.get(health_url, timeout=5)
        print(f"Status Code: {resp.status_code}")
        health_json = resp.json()
        print(f"Response: {health_json}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        assert health_json["service"] == "The Daily Voice API"
        assert "checks" in health_json

        # 2. Probe CORS
        print("\nTesting CORS headers for http://localhost:5173...")
        cors_resp = requests.options(
            health_url,
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
            timeout=5,
        )
        print(f"CORS Status: {cors_resp.status_code}")
        allow_origin = cors_resp.headers.get("Access-Control-Allow-Origin")
        print(f"Access-Control-Allow-Origin: {allow_origin}")
        assert allow_origin in ("http://localhost:5173", "*")

        # 3. Probe Method Not Allowed (405)
        print("\nTesting POST to /api/health (disallowed method)...")
        mna_resp = requests.post(health_url, json={}, timeout=5)
        print(f"Status Code: {mna_resp.status_code}")
        print(f"Response: {mna_resp.json()}")
        assert mna_resp.status_code == 405
        assert mna_resp.json()["code"] == "METHOD_NOT_ALLOWED"

        # 4. Probe Auth Protection (401)
        auth_url = "http://127.0.0.1:5000/api/auth/verify"
        print(f"\nTesting GET {auth_url} without auth token...")
        auth_resp = requests.get(auth_url, timeout=5)
        print(f"Status Code: {auth_resp.status_code}")
        print(f"Response: {auth_resp.json()}")
        assert auth_resp.status_code == 401
        assert auth_resp.json()["code"] == "AUTH_HEADER_MISSING"

        print("\n>>> ALL LIVE SERVER VERIFICATION CHECKS PASSED SUCCESSFULLY! <<<")
        return True
    finally:
        server.shutdown()

if __name__ == "__main__":
    success = test_live_server()
    if not success:
        sys.exit(1)
