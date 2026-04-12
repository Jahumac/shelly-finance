from pathlib import Path
import unittest


class TestHoldingHistoryJS(unittest.TestCase):
    def test_preserves_scroll_position(self):
        js_path = Path(__file__).resolve().parents[1] / "app" / "static" / "js" / "holding-history.js"
        txt = js_path.read_text(encoding="utf-8")
        self.assertTrue(("window.scrollY" in txt) or ("pageYOffset" in txt))
        self.assertIn("window.scrollTo(0, y)", txt)
