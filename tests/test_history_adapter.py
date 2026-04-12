from app.services.history_adapter import adapt_history_for_chart


def test_adapt_history_for_chart_intraday_keeps_time():
    labels, values = adapt_history_for_chart(
        "1d",
        [{"date": "2026-04-12 07:11", "price": 6.373}, {"date": "07:16", "price": "6.40"}],
    )
    assert labels == ["07:11", "07:16"]
    assert values == [6.373, 6.4]


def test_adapt_history_for_chart_non_intraday_keeps_date():
    labels, values = adapt_history_for_chart(
        "1y",
        [{"date": "2026-04-12", "price": 100}, {"date": "2026-04-13 00:00", "price": 101}],
    )
    assert labels == ["2026-04-12", "2026-04-13"]
    assert values == [100.0, 101.0]


def test_adapt_history_for_chart_ignores_bad_rows():
    labels, values = adapt_history_for_chart(
        "1d",
        [{"date": "07:11", "price": None}, {"date": None, "price": 1}, None, {"price": 2}],
    )
    assert labels == ["", ""]
    assert values == [1.0, 2.0]
