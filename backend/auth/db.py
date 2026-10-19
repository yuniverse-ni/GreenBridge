import os
import sqlite3
import datetime
import uuid
from typing import Optional, Dict, Any, List
from .security import hash_password

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "greenbridge.db")


def get_db_connection() -> sqlite3.Connection:
    """
    Get a configured SQLite connection with foreign keys and dict-like row access.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    """
    Initialize SQLite tables and seed default demo accounts.
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Users Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                name TEXT NOT NULL,
                title TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('sme_owner', 'finance_manager')),
                company_name TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                last_login_at TEXT
            );
        """)

        # Indexes for fast lookup
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);")

        conn.commit()

        # Check and seed default accounts
        _seed_default_accounts(conn)
    finally:
        conn.close()


def _seed_default_accounts(conn: sqlite3.Connection) -> None:
    """
    Seed initial SME Owner and Finance Manager accounts if they don't exist yet.
    """
    cursor = conn.cursor()

    seed_accounts = [
        {
            "id": "usr_sme_owner_apex",
            "email": "owner@apex.com",
            "password": "ApexGreen2026!",
            "name": "Dato' Ir. Tan Beng Huat",
            "title": "Managing Director / SME Signatory",
            "role": "sme_owner",
            "company_name": "Apex Precision Engineering Sdn Bhd",
        },
        {
            "id": "usr_finance_mgr_apex",
            "email": "finance@apex.com",
            "password": "ApexGreen2026!",
            "name": "Sarah Wong, CA",
            "title": "Head of Accounts & Sustainability",
            "role": "finance_manager",
            "company_name": "Apex Precision Engineering Sdn Bhd",
        },
    ]

    for acc in seed_accounts:
        cursor.execute("SELECT id FROM users WHERE email = ?;", (acc["email"],))
        existing = cursor.fetchone()
        if not existing:
            pwd_hash, salt = hash_password(acc["password"])
            now_iso = datetime.datetime.utcnow().isoformat() + "Z"
            cursor.execute("""
                INSERT INTO users (id, email, password_hash, salt, name, title, role, company_name, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?);
            """, (
                acc["id"],
                acc["email"],
                pwd_hash,
                salt,
                acc["name"],
                acc["title"],
                acc["role"],
                acc["company_name"],
                now_iso
            ))
            print(f"[SQLite DB] Seeded user: {acc['email']} ({acc['role']})")

    conn.commit()


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ? AND is_active = 1;", (email.strip().lower(),))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ? AND is_active = 1;", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def create_user(
    email: str,
    password: str,
    name: str,
    title: str,
    role: str,
    company_name: str
) -> Dict[str, Any]:
    if role not in ('sme_owner', 'finance_manager'):
        raise ValueError(f"Invalid role '{role}'. Allowed roles are 'sme_owner' or 'finance_manager'.")

    clean_email = email.strip().lower()
    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    pwd_hash, salt = hash_password(password)
    now_iso = datetime.datetime.utcnow().isoformat() + "Z"

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO users (id, email, password_hash, salt, name, title, role, company_name, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?);
        """, (user_id, clean_email, pwd_hash, salt, name.strip(), title.strip(), role, company_name.strip(), now_iso))
        conn.commit()

        cursor.execute("SELECT * FROM users WHERE id = ?;", (user_id,))
        row = cursor.fetchone()
        return dict(row)
    finally:
        conn.close()


def update_last_login(user_id: str) -> None:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        now_iso = datetime.datetime.utcnow().isoformat() + "Z"
        cursor.execute("UPDATE users SET last_login_at = ? WHERE id = ?;", (now_iso, user_id))
        conn.commit()
    finally:
        conn.close()


def to_safe_user(user_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Remove password_hash and salt before returning user object to clients.
    """
    safe = dict(user_dict)
    safe.pop("password_hash", None)
    safe.pop("salt", None)
    return safe
