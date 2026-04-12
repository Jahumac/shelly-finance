from datetime import date
import unittest
from app.calculations import age_from_dob, to_float, contribution_breakdown

class TestCalculations(unittest.TestCase):
    def test_age_from_dob(self):
        cases = [
            ("1980-01-01", date(2024, 1, 1), 44.0),
            ("1980-07-01", date(2024, 1, 1), 43.5),
            ("1980-01-01", date(2024, 1, 15), 44.0),
            ("2000-01-01", date(2024, 1, 1), 24.0),
            ("", date(2024, 1, 1), 0.0),
            (None, date(2024, 1, 1), 0.0),
            ("invalid", date(2024, 1, 1), 0.0),
        ]
        for dob, today, expected in cases:
            self.assertAlmostEqual(age_from_dob(dob, today), expected, places=3)

    def test_to_float(self):
        self.assertEqual(to_float("123.45"), 123.45)
        self.assertEqual(to_float(123.45), 123.45)
        self.assertEqual(to_float(None), 0.0)
        self.assertEqual(to_float("abc"), 0.0)

    def test_contribution_breakdown_sipp(self):
        account = {
            "monthly_contribution": 800,
            "wrapper_type": "SIPP",
            "contribution_method": "standard",
        }
        assumptions = {"tax_band": "basic"}
        breakdown = contribution_breakdown(account, assumptions)
        self.assertEqual(breakdown["personal"], 800)
        self.assertEqual(breakdown["tax_relief"], 200)
        self.assertEqual(breakdown["total_into_pot"], 1000)
        self.assertEqual(breakdown["self_assessment"], 0)

    def test_contribution_breakdown_sipp_higher_rate(self):
        account = {
            "monthly_contribution": 800,
            "wrapper_type": "SIPP",
            "contribution_method": "standard",
        }
        assumptions = {"tax_band": "higher"}
        breakdown = contribution_breakdown(account, assumptions)
        self.assertEqual(breakdown["personal"], 800)
        self.assertEqual(breakdown["tax_relief"], 200)
        self.assertEqual(breakdown["total_into_pot"], 1000)
        self.assertEqual(breakdown["self_assessment"], 200)

    def test_contribution_breakdown_salary_sacrifice(self):
        account = {
            "monthly_contribution": 1000,
            "employer_contribution": 500,
            "wrapper_type": "Workplace Pension",
            "contribution_method": "salary_sacrifice",
        }
        breakdown = contribution_breakdown(account)
        self.assertEqual(breakdown["personal"], 1000)
        self.assertEqual(breakdown["employer"], 500)
        self.assertEqual(breakdown["tax_relief"], 0)
        self.assertEqual(breakdown["total_into_pot"], 1500)
