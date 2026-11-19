from __future__ import annotations

import pytest

from flask.helpers import get_debug_flag
from flask.helpers import get_load_dotenv


class TestGetDebugFlag:
    def test_unset_is_false(self, monkeypatch):
        monkeypatch.delenv("FLASK_DEBUG", raising=False)
        assert get_debug_flag() is False

    @pytest.mark.parametrize("value", ["0", "false", "no", "False", "NO"])
    def test_falsy_values(self, monkeypatch, value):
        monkeypatch.setenv("FLASK_DEBUG", value)
        assert get_debug_flag() is False

    @pytest.mark.parametrize("value", ["1", "true", "yes", "on"])
    def test_truthy_values(self, monkeypatch, value):
        monkeypatch.setenv("FLASK_DEBUG", value)
        assert get_debug_flag() is True


def test_get_load_dotenv_default(monkeypatch):
    monkeypatch.delenv("FLASK_SKIP_DOTENV", raising=False)
    assert get_load_dotenv() is True


def test_get_load_dotenv_skip(monkeypatch):
    monkeypatch.setenv("FLASK_SKIP_DOTENV", "1")
    assert get_load_dotenv() is False
