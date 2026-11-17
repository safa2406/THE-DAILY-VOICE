def test_health_check_endpoint(client):
    """Verify that GET /api/health responds with 200 and structured diagnostic JSON."""
    response = client.get("/api/health")
    assert response.status_code == 200

    data = response.get_json()
    assert data is not None
    assert "status" in data
    assert data["service"] == "The Daily Voice API"
    assert data["version"] == "1.0.0-phase1"
    assert "timestamp" in data
    assert "checks" in data
    assert "database" in data["checks"]
    assert "supabase" in data["checks"]
    assert data["checks"]["database"]["status"] == "connected"

def test_structured_404_error(client):
    """Verify that structured 404 JSON is returned for non-existent routes."""
    response = client.get("/api/non-existent-endpoint")
    assert response.status_code == 404
    data = response.get_json()
    assert data["status"] == "error"
    assert data["code"] == "NOT_FOUND"

def test_structured_405_error(client):
    """Verify that structured 405 JSON is returned for disallowed HTTP methods."""
    response = client.post("/api/health")
    assert response.status_code == 405
    data = response.get_json()
    assert data["status"] == "error"
    assert data["code"] == "METHOD_NOT_ALLOWED"
