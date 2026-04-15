"""Assumptions: growth rate, retirement age, salary settings, UI preferences."""
from ._conn import get_connection


def fetch_assumptions(user_id):
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM assumptions WHERE user_id = ?", (user_id,)
        ).fetchone()
        if row is None:
            conn.execute(
                """INSERT OR IGNORE INTO assumptions (user_id) VALUES (?)""",
                (user_id,),
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM assumptions WHERE user_id = ?", (user_id,)
            ).fetchone()
        return row


def update_assumptions(payload, user_id):
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE assumptions
            SET annual_growth_rate = ?,
                retirement_age = ?,
                date_of_birth = ?,
                retirement_goal_value = ?,
                isa_allowance = ?,
                lisa_allowance = ?,
                dividend_allowance = ?,
                annual_income = ?,
                pension_annual_allowance = ?,
                mpaa_enabled = ?,
                mpaa_allowance = ?,
                target_dev_pct = ?,
                target_em_pct = ?,
                emergency_fund_target = ?,
                dashboard_name = ?,
                salary_day = ?,
                update_day = ?,
                retirement_date_mode = ?,
                tax_band = ?,
                auto_update_prices = ?,
                update_time_morning = ?,
                update_time_evening = ?,
                updated_at = ?
            WHERE user_id = ?
            """,
            (
                payload["annual_growth_rate"],
                payload["retirement_age"],
                payload.get("date_of_birth", ""),
                payload["retirement_goal_value"],
                payload["isa_allowance"],
                payload["lisa_allowance"],
                payload.get("dividend_allowance", 500),
                payload.get("annual_income", 0),
                payload.get("pension_annual_allowance", 60000),
                payload.get("mpaa_enabled", 0),
                payload.get("mpaa_allowance", 10000),
                payload["target_dev_pct"],
                payload["target_em_pct"],
                payload["emergency_fund_target"],
                payload["dashboard_name"],
                payload.get("salary_day", 0),
                payload.get("update_day", 0),
                payload.get("retirement_date_mode", "birthday"),
                payload.get("tax_band", "basic"),
                payload.get("auto_update_prices", 1),
                payload.get("update_time_morning", "08:30"),
                payload.get("update_time_evening", "18:00"),
                payload["updated_at"],
                user_id,
            ),
        )
        conn.commit()
