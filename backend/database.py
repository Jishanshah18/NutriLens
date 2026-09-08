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
            # 1. User Profiles Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_profiles (
                    user_id TEXT PRIMARY KEY,
                    dietary_preferences TEXT,
                    allergies TEXT,
                    health_goals TEXT,
                    updated_at TEXT
                )
            """)

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

    def _seed_default_data(self):
        with self._get_conn() as conn:
            cursor = conn.cursor()

            # Seed Profile if missing
            cursor.execute("SELECT COUNT(*) FROM user_profiles WHERE user_id = 'default_user'")
            if cursor.fetchone()[0] == 0:
                cursor.execute("""
                    INSERT INTO user_profiles (user_id, dietary_preferences, allergies, health_goals, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    "default_user",
                    json.dumps(["Low Sugar", "Diabetic-Friendly"]),
                    json.dumps(["Peanuts", "Lactose Intolerant"]),
                    json.dumps(["Weight Loss", "Heart Health"]),
                    datetime.now(timezone.utc).isoformat()
                ))

            # Seed Stats if missing
            cursor.execute("SELECT COUNT(*) FROM user_stats WHERE user_id = 'default_user'")
            if cursor.fetchone()[0] == 0:
                cursor.execute("""
                    INSERT INTO user_stats (user_id, current_streak, scans_today, total_scans, xp, level, last_active_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    "default_user", 14, 3, 28, 450, 3,
                    datetime.now(timezone.utc).strftime("%Y-%m-%d")
                ))

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
        self.user_stats: Dict[str, Dict[str, Any]] = {}
        self.badges: Dict[str, List[Dict[str, Any]]] = {}
        self.quizzes: List[Dict[str, Any]] = []

        with self._get_conn() as conn:
            cursor = conn.cursor()

            # Load Profiles
            for row in cursor.execute("SELECT user_id, dietary_preferences, allergies, health_goals FROM user_profiles"):
                self.profiles[row[0]] = {
                    "user_id": row[0],
                    "dietary_preferences": json.loads(row[1] or "[]"),
                    "allergies": json.loads(row[2] or "[]"),
                    "health_goals": json.loads(row[3] or "[]")
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
                INSERT INTO user_profiles (user_id, dietary_preferences, allergies, health_goals, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    dietary_preferences=excluded.dietary_preferences,
                    allergies=excluded.allergies,
                    health_goals=excluded.health_goals,
                    updated_at=excluded.updated_at
            """, (
                user_id,
                json.dumps(profile_dict.get("dietary_preferences", [])),
                json.dumps(profile_dict.get("allergies", [])),
                json.dumps(profile_dict.get("health_goals", [])),
                datetime.now(timezone.utc).isoformat()
            ))
            conn.commit()

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
