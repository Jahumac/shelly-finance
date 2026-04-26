from datetime import datetime

from flask import Blueprint, render_template
from flask_login import current_user, login_required

from app.calculations import to_float, uk_tax_year_start, uk_tax_year_end, uk_tax_year_label
from app.models import fetch_all_accounts, fetch_assumptions, fetch_daily_snapshots, fetch_holding_totals_by_account, fetch_tax_year_contributions

performance_bp = Blueprint("performance", __name__)


@performance_bp.route("/")
@login_required
def performance():
    uid = current_user.id
    assumptions   = fetch_assumptions(uid)
    accounts      = fetch_all_accounts(uid)

    assumed_rate   = to_float(assumptions["annual_growth_rate"]) if assumptions else 0.07
    benchmark_rate = to_float(assumptions["benchmark_rate"]) if assumptions and assumptions["benchmark_rate"] is not None else None
    benchmark_rate_pct = round(benchmark_rate * 100, 1) if benchmark_rate is not None else None

    # Daily snapshots for the chart (same as overview)
    daily_snapshots = fetch_daily_snapshots(uid, limit=730)
    has_data = len(daily_snapshots) >= 2

    daily_labels = []
    daily_actual = []
    daily_plan   = []
    daily_bench  = []
    plan_value      = None
    benchmark_value = None
    current_value   = None

    if has_data:
        start_val = daily_snapshots[0][1]
        daily_rate_plan  = (1 + assumed_rate) ** (1 / 365) - 1
        daily_rate_bench = (1 + benchmark_rate) ** (1 / 365) - 1 if benchmark_rate else None

        for i, (date_str, val) in enumerate(daily_snapshots):
            # Format date label same style as overview
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                label = dt.strftime("%-d %b %Y")
            except ValueError:
                label = date_str
            daily_labels.append(label)
            daily_actual.append(round(val, 2))
            daily_plan.append(round(start_val * ((1 + daily_rate_plan) ** i), 2))
            if daily_rate_bench is not None:
                daily_bench.append(round(start_val * ((1 + daily_rate_bench) ** i), 2))

        current_value   = daily_actual[-1]
        plan_value      = daily_plan[-1]
        benchmark_value = daily_bench[-1] if daily_bench else None

    # By Account — live values only, no monthly snapshot dependency
    holding_totals = fetch_holding_totals_by_account(uid)
    account_perf = []
    for a in accounts:
        if a.get("valuation_mode") == "holdings":
            cv = float(holding_totals.get(a["id"], 0))
        else:
            cv = to_float(a.get("current_value"))
        if cv > 0:
            account_perf.append({"account_name": a["name"], "current_value": cv})
    account_perf.sort(key=lambda x: -x["current_value"])

    return render_template(
        "performance.html",
        has_data=has_data,
        daily_labels=daily_labels,
        daily_actual=daily_actual,
        daily_plan=daily_plan,
        daily_bench=daily_bench,
        assumed_rate_pct=round(assumed_rate * 100, 1),
        benchmark_rate_pct=benchmark_rate_pct,
        account_perf=account_perf,
        plan_value=plan_value,
        benchmark_value=benchmark_value,
        current_value=current_value,
        active_page="performance",
    )


@performance_bp.route("/contributions/")
@login_required
def contribution_summary():
    uid = current_user.id
    today = datetime.now().date()
    ty_start = uk_tax_year_start(today)
    ty_end   = uk_tax_year_end(today)
    from_month = ty_start.strftime("%Y-%m")
    to_month   = ty_end.strftime("%Y-%m")

    rows = fetch_tax_year_contributions(uid, from_month, to_month)

    # Build month list for the tax year (Apr through Mar, only past/current months)
    months = []
    y, m = ty_start.year, ty_start.month
    current_ym = today.strftime("%Y-%m")
    while True:
        mk = f"{y:04d}-{m:02d}"
        if mk > current_ym:
            break
        months.append(mk)
        m += 1
        if m > 12:
            m = 1
            y += 1
        if mk > to_month:
            break

    # Index rows by (account_id, month_key)
    data = {}      # {account_id: {"name": str, "wrapper_type": str, "months": {mk: {expected, confirmed}}}}
    for r in rows:
        aid = r["account_id"]
        if aid not in data:
            data[aid] = {
                "name": r["account_name"],
                "wrapper_type": r["wrapper_type"],
                "months": {},
            }
        data[aid]["months"][r["month_key"]] = {
            "expected": float(r["expected_contribution"] or 0),
            "confirmed": bool(r["contribution_confirmed"]),
            "skipped": bool(r["is_skipped"]),
        }

    # Sort accounts by name
    accounts = sorted(data.values(), key=lambda a: a["name"])

    # Month display labels
    month_labels = []
    for mk in months:
        try:
            month_labels.append(datetime.strptime(mk, "%Y-%m").strftime("%b %Y"))
        except ValueError:
            month_labels.append(mk)

    # Column totals
    month_totals = {}
    for mk in months:
        month_totals[mk] = sum(
            a["months"].get(mk, {}).get("expected", 0) for a in accounts
        )

    return render_template(
        "contribution_summary.html",
        accounts=accounts,
        months=months,
        month_labels=month_labels,
        month_totals=month_totals,
        tax_year=uk_tax_year_label(today),
        active_page="performance",
    )
