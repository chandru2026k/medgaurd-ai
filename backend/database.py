import sqlite3
from contextlib import contextmanager

DB_PATH = "patients.db"

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS patient_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                age INTEGER,
                gender TEXT,
                dob TEXT,
                height TEXT,
                weight TEXT,
                blood_type TEXT,
                allergies TEXT,
                conditions TEXT,
                medications TEXT NOT NULL
            )
        """)
        conn.commit()

init_db()

@contextmanager
def get_db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
