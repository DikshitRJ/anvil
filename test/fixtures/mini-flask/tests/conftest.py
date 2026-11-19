from __future__ import annotations

import os
import sys

import pytest

from flask import Flask

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))


@pytest.fixture
def app():
    app = Flask("flask_test")
    app.config.update(TESTING=True, SECRET_KEY="test key")
    return app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def runner(app):
    return app.test_cli_runner()
