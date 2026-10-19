import pytest
from fastapi.testclient import TestClient
from main import app
from auth.db import init_db, get_user_by_email, create_user
from auth.security import hash_password, verify_password, create_access_token, verify_access_token

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_test_db():
    init_db()


def test_seed_users_exist_and_passwords_match():
    # Test SME Owner
    owner = get_user_by_email("owner@apex.com")
    assert owner is not None
    assert owner["role"] == "sme_owner"
    assert owner["name"] == "Dato' Ir. Tan Beng Huat"
    assert verify_password("ApexGreen2026!", owner["password_hash"], owner["salt"]) is True
    assert verify_password("WrongPassword!", owner["password_hash"], owner["salt"]) is False

    # Test Finance Manager
    finance = get_user_by_email("finance@apex.com")
    assert finance is not None
    assert finance["role"] == "finance_manager"
    assert finance["name"] == "Sarah Wong, CA"
    assert verify_password("ApexGreen2026!", finance["password_hash"], finance["salt"]) is True


def test_jwt_token_creation_and_verification():
    user_payload = {
        "user_id": "usr_test_123",
        "email": "test@sme.com",
        "role": "sme_owner",
        "name": "Test User",
    }
    token = create_access_token(user_payload, expires_in=3600)
    assert isinstance(token, str)
    assert len(token.split(".")) == 3

    payload = verify_access_token(token)
    assert payload is not None
    assert payload["email"] == "test@sme.com"
    assert payload["role"] == "sme_owner"


def test_api_login_success():
    resp = client.post("/api/auth/login", json={
        "email": "owner@apex.com",
        "password": "ApexGreen2026!"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "token" in data
    assert data["user"]["email"] == "owner@apex.com"
    assert data["user"]["role"] == "sme_owner"
    assert "password_hash" not in data["user"]


def test_api_login_invalid_credentials():
    resp = client.post("/api/auth/login", json={
        "email": "owner@apex.com",
        "password": "WrongPassword!"
    })
    assert resp.status_code == 401
    assert "Invalid email or password" in resp.json()["detail"]


def test_api_register_new_sme_user():
    import uuid
    random_email = f"user_{uuid.uuid4().hex[:6]}@factory.com"
    resp = client.post("/api/auth/register", json={
        "email": random_email,
        "password": "SecretPassword123!",
        "name": "Alex Lee",
        "title": "Director",
        "role": "sme_owner",
        "company_name": "Lee Metal Works Sdn Bhd"
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["success"] is True
    assert "token" in data
    assert data["user"]["email"] == random_email
    assert data["user"]["name"] == "Alex Lee"

    # Test me endpoint with newly issued token
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {data['token']}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["user"]["email"] == random_email


def test_api_register_invalid_role():
    resp = client.post("/api/auth/register", json={
        "email": "hacker@evil.com",
        "password": "SecretPassword123!",
        "name": "Hacker",
        "role": "unauthorized_role",
        "company_name": "Fake Corp"
    })
    assert resp.status_code == 400
