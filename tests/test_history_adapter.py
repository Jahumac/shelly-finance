from app.services.history_adapter import adapt_history_for_chart


import unittest


class TestHistoryAdapter(unittest.TestCase):
    def test_intraday_keeps_time(self):
        labels, values = adapt_history_for_chart(
            "1d",
            [{"date": "2026-04-12 07:11", "price": 6.373}, {"date": "07:16", "price": "6.40"}],
        )
        self.assertEqual(labels, ["07:11", "07:16"])
        self.assertEqual(values, [6.373, 6.4])

    def test_non_intraday_keeps_date(self):
        labels, values = adapt_history_for_chart(
            "1y",
            [{"date": "2026-04-12", "price": 100}, {"date": "2026-04-13 00:00", "price": 101}],
        )
        self.assertEqual(labels, ["2026-04-12", "2026-04-13"])
        self.assertEqual(values, [100.0, 101.0])

    def test_ignores_bad_rows(self):
        labels, values = adapt_history_for_chart(
            "1d",
            [{"date": "07:11", "price": None}, {"date": None, "price": 1}, None, {"price": 2}],
        )
        self.assertEqual(labels, ["", ""])
        self.assertEqual(values, [1.0, 2.0])
