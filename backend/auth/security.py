import os
import time
import json
import hmac
import hashlib
import secrets
from typing import Optional, Dict, Any

JWT_SECRET = os.environ.get("JWT_SECRET", "greenbridge_sqlite_jwt_secret_2026_supersecure")
TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60  # 7 days


def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """
    Hash a password using PBKDF2-HMAC-SHA256 with 100,000 iterations and a random salt.
    Returns (hex_hash, hex_salt).
    """
    if not salt:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000
    )
    return key.hex(), salt


def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    """
    Verify password against stored PBKDF2 hash using constant-time comparison.
    """
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000
    )
    return hmac.compare_digest(key.hex(), stored_hash)


import base64

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(str_data: str) -> bytes:
    pad = 4 - (len(str_data) % 4)
    if pad != 4:
        str_data += "=" * pad
    return base64.urlsafe_b64decode(str_data.encode("ascii"))


def create_access_token(user_data: Dict[str, Any], expires_in: int = TOKEN_EXPIRY_SECONDS) -> str:
    """
    Generate a signed JWT token using HMAC-SHA256.
    """
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        **user_data,
        "iat": now,
        "exp": now + expires_in,
    }

    header_bytes = json.dumps(header, separators=(",", ":")).encode("utf-8")
    payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")

    encoded_header = _b64url_encode(header_bytes.decode("utf-8").encode("ascii"))
    encoded_payload = _b64url_encode(payload_bytes.decode("utf-8").encode("ascii"))
    signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")

    signature = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    encoded_signature = _b64url_encode(signature)

    return f"{encoded_header}.{encoded_payload}.{encoded_signature}"


def verify_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Validate signature and expiration of a JWT token.
    Returns decoded payload dict if valid, else None.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        encoded_header, encoded_payload, encoded_signature = parts
        signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")

        expected_sig = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
        actual_sig = _b64url_decode(encoded_signature)

        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        payload = json.loads(_b64url_decode(encoded_payload).decode("utf-8"))
        if payload.get("exp") and payload["exp"] < int(time.time()):
            return None  # Expired

        return payload
    except Exception:
        return None
