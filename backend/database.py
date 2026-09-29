import os
import json
import sqlite3
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("Notice: 'python-dotenv' package is not installed. Reading system environment variables directly.")

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY")

supabase = None

if SUPABASE_URL and SUPABASE_KEY and SUPABASE_URL != "your_supabase_url_here":
    try:
        from supabase import create_client
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print(f"Supabase cloud database connected successfully to {SUPABASE_URL}.")
    except Exception as e:
        print(f"Warning: Failed to connect to Supabase: {e}. Falling back to SQLite persistent database.")
else:
    print("Notice: Supabase credentials not configured. Using local SQLite persistent database.")



DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nutrilens.db")


class PersistentStore:
    """
    Persistent Database Store supporting local SQLite (nutrilens.db)
    with optional Supabase cloud sync and full in-memory cache compatibility.
    """
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._init_sqlite()
        self.load_from_db()

    def _get_conn(self):
        return sqlite3.connect(self.db_path)

    def _init_sqlite(self):
        with self._get_conn() as conn:
            cursor = conn.cursor()
            # 0. Users Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE,
                    password_hash TEXT,
                    full_name TEXT,
                    created_at TEXT
                )
            """)

            # 1. User Profiles Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_profiles (
                    user_id TEXT PRIMARY KEY,
                    dietary_preferences TEXT,
                    allergies TEXT,
                    health_goals TEXT,
                    health_conditions TEXT,
                    email TEXT,
                    full_name TEXT,
                    updated_at TEXT
                )
            """)

            # Dynamic migration for existing user_profiles table if columns missing
            cursor.execute("PRAGMA table_info(user_profiles)")
            existing_cols = [row[1] for row in cursor.fetchall()]
            if "health_conditions" not in existing_cols:
                cursor.execute("ALTER TABLE user_profiles ADD COLUMN health_conditions TEXT")
            if "email" not in existing_cols:
                cursor.execute("ALTER TABLE user_profiles ADD COLUMN email TEXT")
            if "full_name" not in existing_cols:
                cursor.execute("ALTER TABLE user_profiles ADD COLUMN full_name TEXT")

            # 2. Scan History Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS scan_history (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    product_name TEXT,
                    scanned_at TEXT,
                    health_score INTEGER,
                    allergen_flags TEXT,
                    verdict_summary TEXT,
                    ocr_text TEXT
                )
            """)

            # 3. User Stats Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_stats (
                    user_id TEXT PRIMARY KEY,
                    current_streak INTEGER,
                    scans_today INTEGER,
                    total_scans INTEGER,
                    xp INTEGER,
                    level INTEGER,
                    last_active_date TEXT
                )
            """)

            # 4. Badges Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS badges (
                    id TEXT,
                    user_id TEXT,
                    name TEXT,
                    icon TEXT,
                    description TEXT,
                    unlocked INTEGER,
                    unlocked_at TEXT,
                    PRIMARY KEY (id, user_id)
                )
            """)

            # 5. Quizzes Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS quizzes (
                    id TEXT PRIMARY KEY,
                    type TEXT,
                    title TEXT,
                    question TEXT,
                    options TEXT,
                    correct_answer TEXT,
                    explanation TEXT,
                    xp_reward INTEGER
                )
            """)

            conn.commit()

        self._seed_default_data()

    def _hash_password(self, password: str) -> str:
        import hashlib
        return hashlib.sha256(f"nutrilens_salt_{password}".encode("utf-8")).hexdigest()

    def _seed_default_data(self):
        with self._get_conn() as conn:
            cursor = conn.cursor()

            # Seed Default Users & Profiles
            demo_accounts = [
                {
                    "id": "default_user",
                    "email": "jishan@nutrilens.ai",
                    "name": "Jishan Ahmed",
                    "conditions": ["Diabetes", "High Blood Pressure"],
                    "preferences": ["Low Sugar", "Diabetic-Friendly"],
                    "allergies": ["Peanuts", "Lactose Intolerant"],
                    "goals": ["Weight Loss", "Heart Health"],
                    "stats": (14, 3, 28, 450, 3)
                },
                {
                    "id": "user_diabetes",
                    "email": "sarah.diabetes@nutrilens.ai",
                    "name": "Sarah Connor (Diabetes)",
                    "conditions": ["Diabetes"],
                    "preferences": ["Low Sugar"],
                    "allergies": [],
                    "goals": ["Blood Sugar Control"],
                    "stats": (8, 2, 16, 280, 2)
                },
                {
                    "id": "user_hypertension",
                    "email": "marcus.bp@nutrilens.ai",
                    "name": "Marcus Vance (High BP)",
                    "conditions": ["High Blood Pressure"],
                    "preferences": ["Low-Sodium"],
                    "allergies": [],
                    "goals": ["Heart Health"],
                    "stats": (11, 4, 22, 340, 3)
                },
                {
                    "id": "user_clean",
                    "email": "elena.wellness@nutrilens.ai",
                    "name": "Elena Gomez (General Wellness)",
                    "conditions": [],
                    "preferences": ["Whole Food"],
                    "allergies": [],
                    "goals": ["Clean Purity"],
                    "stats": (5, 1, 9, 150, 1)
                }
            ]

            now_iso = datetime.now(timezone.utc).isoformat()
            now_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

            for acct in demo_accounts:
                cursor.execute("SELECT COUNT(*) FROM users WHERE id = ?", (acct["id"],))
                if cursor.fetchone()[0] == 0:
                    cursor.execute("""
                        INSERT INTO users (id, email, password_hash, full_name, created_at)
                        VALUES (?, ?, ?, ?, ?)
                    """, (
                        acct["id"],
                        acct["email"],
                        self._hash_password("password123"),
                        acct["name"],
                        now_iso
                    ))

                cursor.execute("SELECT COUNT(*) FROM user_profiles WHERE user_id = ?", (acct["id"],))
                if cursor.fetchone()[0] == 0:
                    cursor.execute("""
                        INSERT INTO user_profiles (user_id, dietary_preferences, allergies, health_goals, health_conditions, email, full_name, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        acct["id"],
                        json.dumps(acct["preferences"]),
                        json.dumps(acct["allergies"]),
                        json.dumps(acct["goals"]),
                        json.dumps(acct["conditions"]),
                        acct["email"],
                        acct["name"],
                        now_iso
                    ))
                else:
                    # Update health_conditions if it was previously empty or null
                    cursor.execute("""
                        UPDATE user_profiles
                        SET health_conditions = COALESCE(health_conditions, ?),
                            email = COALESCE(email, ?),
                            full_name = COALESCE(full_name, ?)
                        WHERE user_id = ?
                    """, (
                        json.dumps(acct["conditions"]),
                        acct["email"],
                        acct["name"],
                        acct["id"]
                    ))

                cursor.execute("SELECT COUNT(*) FROM user_stats WHERE user_id = ?", (acct["id"],))
                if cursor.fetchone()[0] == 0:
                    st = acct["stats"]
                    cursor.execute("""
                        INSERT INTO user_stats (user_id, current_streak, scans_today, total_scans, xp, level, last_active_date)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (acct["id"], st[0], st[1], st[2], st[3], st[4], now_date))

            # Seed History if missing
            cursor.execute("SELECT COUNT(*) FROM scan_history")
            if cursor.fetchone()[0] == 0:
                sample_history = [
                    (
                        "scan-1", "default_user", "Organic Almond Milk",
                        datetime.now(timezone.utc).isoformat(), 88,
                        json.dumps([]),
                        "Excellent choice! Clean ingredients with low sugar.",
                        "Almond milk, sea salt, calcium carbonate, vitamin D2"
                    ),
                    (
                        "scan-2", "default_user", "Chocolate Chip Cookies",
                        datetime.now(timezone.utc).isoformat(), 42,
                        json.dumps(["Lactose"]),
                        "High added sugars and saturated fat. Consume sparingly.",
                        "Wheat flour, sugar, palm oil, chocolate chips, milk powder, soy lecithin, artificial flavor"
                    )
                ]
                cursor.executemany("""
                    INSERT INTO scan_history (id, user_id, product_name, scanned_at, health_score, allergen_flags, verdict_summary, ocr_text)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, sample_history)

            # Seed Badges if missing
            cursor.execute("SELECT COUNT(*) FROM badges WHERE user_id = 'default_user'")
            if cursor.fetchone()[0] == 0:
                sample_badges = [
                    ("b-1", "default_user", "Avocado Lover", "🥑", "Scanned 10 whole organic foods", 1, "2026-07-20"),
                    ("b-2", "default_user", "Allergy Defender", "🛡️", "Avoided 5 conflicting allergen items", 1, "2026-07-25"),
                    ("b-3", "default_user", "Nutrition Expert", "🏆", "Completed 15 daily health quizzes", 0, None),
                    ("b-4", "default_user", "Streak Master", "🔥", "Maintained a 14-day daily scan streak", 1, "2026-08-05")
                ]
                cursor.executemany("""
                    INSERT INTO badges (id, user_id, name, icon, description, unlocked, unlocked_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, sample_badges)

            # Seed Quizzes if missing
            cursor.execute("SELECT COUNT(*) FROM quizzes")
            if cursor.fetchone()[0] == 0:
                sample_quizzes = [
                    (
                        "q-101", "myth_vs_fact", "Sugar & Health Myth",
                        "Does eating sugar directly cause diabetes on its own?",
                        json.dumps(["Fact - Sugar directly causes type 2 diabetes", "Myth - Weight & genetics are primary drivers, though high sugar contributes"]),
                        "Myth - Weight & genetics are primary drivers, though high sugar contributes",
                        "Eating sugar alone does not directly cause Type 2 diabetes, but excess calorie intake leading to obesity is a major risk factor.",
                        50
                    ),
                    (
                        "q-102", "multiple_choice", "Ultra-Processed Foods",
                        "What is an ultra-processed food formulation?",
                        json.dumps(["Unprocessed natural food", "Processed culinary ingredient", "Minimally processed food", "Industrial formulation with artificial additives"]),
                        "Industrial formulation with artificial additives",
                        "Ultra-processed foods are industrial formulations made mostly from substances derived from foods, artificial flavorings, and emulsifiers.",
                        50
                    )
                ]
                cursor.executemany("""
                    INSERT INTO quizzes (id, type, title, question, options, correct_answer, explanation, xp_reward)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, sample_quizzes)

            conn.commit()

    def load_from_db(self):
        """Populates in-memory representations from SQLite."""
        self.profiles: Dict[str, Dict[str, Any]] = {}
        self.scan_history: List[Dict[str, Any]] = []
        self.users: Dict[str, Dict[str, Any]] = {}
        self.profiles: Dict[str, Dict[str, Any]] = {}
        self.scan_history: List[Dict[str, Any]] = []
        self.user_stats: Dict[str, Dict[str, Any]] = {}
        self.badges: Dict[str, List[Dict[str, Any]]] = {}
        self.quizzes: List[Dict[str, Any]] = []

        with self._get_conn() as conn:
            cursor = conn.cursor()

            # Load Users
            for row in cursor.execute("SELECT id, email, full_name, created_at FROM users"):
                self.users[row[0]] = {
                    "id": row[0],
                    "email": row[1],
                    "full_name": row[2],
                    "created_at": row[3]
                }

            # Load Profiles
            for row in cursor.execute("SELECT user_id, dietary_preferences, allergies, health_goals, health_conditions, email, full_name FROM user_profiles"):
                self.profiles[row[0]] = {
                    "user_id": row[0],
                    "dietary_preferences": json.loads(row[1] or "[]"),
                    "allergies": json.loads(row[2] or "[]"),
                    "health_goals": json.loads(row[3] or "[]"),
                    "health_conditions": json.loads(row[4] or "[]") if len(row) > 4 and row[4] else [],
                    "email": row[5] if len(row) > 5 and row[5] else "",
                    "full_name": row[6] if len(row) > 6 and row[6] else ""
                }

            # Load History
            for row in cursor.execute("SELECT id, product_name, scanned_at, health_score, allergen_flags, verdict_summary, ocr_text FROM scan_history ORDER BY scanned_at DESC"):
                self.scan_history.append({
                    "id": row[0],
                    "product_name": row[1],
                    "scanned_at": row[2],
                    "health_score": row[3],
                    "allergen_flags": json.loads(row[4] or "[]"),
                    "verdict_summary": row[5],
                    "ocr_text": row[6]
                })

            # Load User Stats
            for row in cursor.execute("SELECT user_id, current_streak, scans_today, total_scans, xp, level, last_active_date FROM user_stats"):
                self.user_stats[row[0]] = {
                    "user_id": row[0],
                    "current_streak": row[1],
                    "scans_today": row[2],
                    "total_scans": row[3],
                    "xp": row[4],
                    "level": row[5],
                    "last_active_date": row[6]
                }

            # Load Badges
            for row in cursor.execute("SELECT id, user_id, name, icon, description, unlocked, unlocked_at FROM badges"):
                uid = row[1]
                if uid not in self.badges:
                    self.badges[uid] = []
                self.badges[uid].append({
                    "id": row[0],
                    "name": row[2],
                    "icon": row[3],
                    "description": row[4],
                    "unlocked": bool(row[5]),
                    "unlocked_at": row[6]
                })

            # Load Quizzes
            for row in cursor.execute("SELECT id, type, title, question, options, correct_answer, explanation, xp_reward FROM quizzes"):
                self.quizzes.append({
                    "id": row[0],
                    "type": row[1],
                    "title": row[2],
                    "question": row[3],
                    "options": json.loads(row[4] or "[]"),
                    "correct_answer": row[5],
                    "explanation": row[6],
                    "xp_reward": row[7]
                })

    def save_profile(self, profile_dict: Dict[str, Any]):
        user_id = profile_dict.get("user_id", "default_user")
        self.profiles[user_id] = profile_dict
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO user_profiles (user_id, dietary_preferences, allergies, health_goals, health_conditions, email, full_name, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    dietary_preferences=excluded.dietary_preferences,
                    allergies=excluded.allergies,
                    health_goals=excluded.health_goals,
                    health_conditions=excluded.health_conditions,
                    email=excluded.email,
                    full_name=excluded.full_name,
                    updated_at=excluded.updated_at
            """, (
                user_id,
                json.dumps(profile_dict.get("dietary_preferences", [])),
                json.dumps(profile_dict.get("allergies", [])),
                json.dumps(profile_dict.get("health_goals", [])),
                json.dumps(profile_dict.get("health_conditions", [])),
                profile_dict.get("email", ""),
                profile_dict.get("full_name", ""),
                datetime.now(timezone.utc).isoformat()
            ))
            conn.commit()

    def register_user(
        self,
        email: str,
        password: str,
        full_name: str,
        health_conditions: Optional[List[str]] = None,
        dietary_preferences: Optional[List[str]] = None,
        allergies: Optional[List[str]] = None,
        health_goals: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        email_clean = email.strip().lower()
        now_iso = datetime.now(timezone.utc).isoformat()
        import re
        user_id = f"user_{re.sub(r'[^a-zA-Z0-9_]', '_', email_clean.split('@')[0])}"

        with self._get_conn() as conn:
            cursor = conn.cursor()
            # Check existing email
            cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email_clean,))
            existing = cursor.fetchone()
            if existing:
                raise ValueError("An account with this email address already exists. Please log in.")

            cursor.execute("""
                INSERT INTO users (id, email, password_hash, full_name, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (
                user_id,
                email_clean,
                self._hash_password(password),
                full_name.strip(),
                now_iso
            ))

            conds = health_conditions or []
            prefs = dietary_preferences or []
            algs = allergies or []
            goals = health_goals or []

            cursor.execute("""
                INSERT OR REPLACE INTO user_profiles (user_id, dietary_preferences, allergies, health_goals, health_conditions, email, full_name, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                user_id,
                json.dumps(prefs),
                json.dumps(algs),
                json.dumps(goals),
                json.dumps(conds),
                email_clean,
                full_name.strip(),
                now_iso
            ))

            cursor.execute("""
                INSERT OR IGNORE INTO user_stats (user_id, current_streak, scans_today, total_scans, xp, level, last_active_date)
                VALUES (?, 1, 0, 0, 100, 1, ?)
            """, (user_id, datetime.now(timezone.utc).strftime("%Y-%m-%d")))

            conn.commit()

        # Update cache
        self.users[user_id] = {
            "id": user_id,
            "email": email_clean,
            "full_name": full_name.strip(),
            "created_at": now_iso
        }
        prof = {
            "user_id": user_id,
            "dietary_preferences": prefs,
            "allergies": algs,
            "health_goals": goals,
            "health_conditions": conds,
            "email": email_clean,
            "full_name": full_name.strip()
        }
        self.profiles[user_id] = prof
        return {"user_id": user_id, "email": email_clean, "full_name": full_name.strip(), "profile": prof}

    def authenticate_user(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        email_clean = email.strip().lower()
        pwd_hash = self._hash_password(password)

        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, email, full_name FROM users
                WHERE LOWER(email) = ? AND password_hash = ?
            """, (email_clean, pwd_hash))
            row = cursor.fetchone()
            if not row:
                # Also allow logging in directly by username/ID with password123 for seamless testing
                cursor.execute("""
                    SELECT id, email, full_name FROM users
                    WHERE id = ? AND password_hash = ?
                """, (email_clean, pwd_hash))
                row = cursor.fetchone()
                if not row:
                    return None

            user_id, user_email, user_name = row[0], row[1], row[2]
            prof = self.profiles.get(user_id)
            if not prof:
                self.load_from_db()
                prof = self.profiles.get(user_id, {
                    "user_id": user_id,
                    "dietary_preferences": [],
                    "allergies": [],
                    "health_goals": [],
                    "health_conditions": [],
                    "email": user_email,
                    "full_name": user_name
                })

            return {
                "user_id": user_id,
                "email": user_email,
                "full_name": user_name,
                "profile": prof
            }

    def get_all_users(self) -> List[Dict[str, Any]]:
        user_list = []
        for uid, u in self.users.items():
            prof = self.profiles.get(uid, {})
            user_list.append({
                "id": uid,
                "email": u.get("email", ""),
                "full_name": u.get("full_name", ""),
                "health_conditions": prof.get("health_conditions", [])
            })
        return user_list

    def save_scan(self, item_dict: Dict[str, Any], user_id: str = "default_user"):
        self.scan_history.insert(0, item_dict)
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO scan_history (id, user_id, product_name, scanned_at, health_score, allergen_flags, verdict_summary, ocr_text)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                item_dict["id"],
                user_id,
                item_dict["product_name"],
                item_dict["scanned_at"],
                item_dict["health_score"],
                json.dumps(item_dict["allergen_flags"]),
                item_dict["verdict_summary"],
                item_dict["ocr_text"]
            ))
            conn.commit()

    def update_user_stats(self, user_id: str, stats_dict: Dict[str, Any]):
        self.user_stats[user_id] = stats_dict
        if supabase:
            try:
                clean_stats = {
                    "user_id": user_id,
                    "current_streak": stats_dict.get("current_streak", 1),
                    "scans_today": stats_dict.get("scans_today", 1),
                    "total_scans": stats_dict.get("total_scans", 1),
                    "xp": stats_dict.get("xp", 0),
                    "level": stats_dict.get("level", 1),
                    "last_active_date": stats_dict.get("last_active_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
                }
                supabase.table("user_stats").upsert(clean_stats).execute()
            except Exception as e:
                print(f"Supabase update user_stats error: {e}")

        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO user_stats (user_id, current_streak, scans_today, total_scans, xp, level, last_active_date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    current_streak=excluded.current_streak,
                    scans_today=excluded.scans_today,
                    total_scans=excluded.total_scans,
                    xp=excluded.xp,
                    level=excluded.level,
                    last_active_date=excluded.last_active_date
            """, (
                user_id,
                stats_dict.get("current_streak", 1),
                stats_dict.get("scans_today", 1),
                stats_dict.get("total_scans", 1),
                stats_dict.get("xp", 0),
                stats_dict.get("level", 1),
                stats_dict.get("last_active_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
            ))
            conn.commit()


    def delete_scan(self, scan_id: str) -> bool:
        original_len = len(self.scan_history)
        self.scan_history = [s for s in self.scan_history if s["id"] != scan_id]
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM scan_history WHERE id = ?", (scan_id,))
            conn.commit()
        return len(self.scan_history) < original_len


db_store = PersistentStore()
