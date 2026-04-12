from pathlib import Path


def test_holding_history_js_preserves_scroll_position():
    js_path = Path(__file__).resolve().parents[1] / "app" / "static" / "js" / "holding-history.js"
    txt = js_path.read_text(encoding="utf-8")
    assert "window.scrollY" in txt or "pageYOffset" in txt
    assert "window.scrollTo(0, y)" in txt
