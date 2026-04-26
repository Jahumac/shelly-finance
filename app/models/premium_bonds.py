"""Premium Bonds prize tracking model."""
from datetime import datetime, timezone

from ._conn import get_connection


def log_prize(account_id, user_id, month_key, prize_amount):
    """Upsert a prize win for a given (account, month). Zero = no win that month."""
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO premium_bonds_prizes (user_id, account_id, month_key, prize_amount, logged_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(account_id, month_key) DO UPDATE SET
                prize_amount = excluded.prize_amount,
                logged_at = excluded.logged_at
            """,
            (user_id, account_id, month_key, prize_amount,
             datetime.now(timezone.utc).isoformat()),
        )


def fetch_prizes(account_id, user_id):
    """Return all prize rows for an account, newest first."""
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, month_key, prize_amount, logged_at
            FROM premium_bonds_prizes
            WHERE account_id = ? AND user_id = ?
            ORDER BY month_key DESC
            """,
            (account_id, user_id),
        ).fetchall()
    return [dict(r) for r in rows]


def fetch_prize_for_month(account_id, month_key):
    """Return the prize row for a specific month, or None."""
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT id, month_key, prize_amount, logged_at
            FROM premium_bonds_prizes
            WHERE account_id = ? AND month_key = ?
            """,
            (account_id, month_key),
        ).fetchone()
    return dict(row) if row else None


def fetch_prizes_tax_year(account_id, user_id, ty_start_month, ty_end_month):
    """Return total prize winnings between two month_keys (inclusive)."""
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT COALESCE(SUM(prize_amount), 0) AS total
            FROM premium_bonds_prizes
            WHERE account_id = ? AND user_id = ?
              AND month_key >= ? AND month_key <= ?
            """,
            (account_id, user_id, ty_start_month, ty_end_month),
        ).fetchone()
    return float(row["total"]) if row else 0.0


def delete_prize(prize_id, user_id):
    """Remove a prize entry (ownership-checked via user_id)."""
    with get_connection() as conn:
        conn.execute(
            "DELETE FROM premium_bonds_prizes WHERE id = ? AND user_id = ?",
            (prize_id, user_id),
        )
