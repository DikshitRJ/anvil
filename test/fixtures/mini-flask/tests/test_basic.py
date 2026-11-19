from __future__ import annotations

import pytest

from flask import Flask
from flask import jsonify
from flask import render_template
from flask import session


def test_options_work():
    app = Flask(__name__)

    @app.route("/", methods=["GET", "POST"])
    def index():
        return "Hello World"

    assert "index" in app.view_functions


def test_response_object_defaults():
    app = Flask(__name__)
    rv = app.make_response("hello")
    assert rv.status == 200
    assert rv.mimetype == "text/html"


def test_session_requires_secret_key():
    app = Flask(__name__)
    assert app.config["SECRET_KEY"] is None


def test_json_provider_sorts_keys():
    app = Flask(__name__)
    assert app.json.dumps({"b": 1, "a": 2}) == '{"a": 2, "b": 1}'


def test_debug_property_follows_config():
    app = Flask(__name__)
    app.debug = True
    assert app.config["DEBUG"] is True


def test_route_decorator_registers_endpoint():
    app = Flask(__name__)

    @app.route("/hello")
    def hello():
        return "hi"

    assert app.view_functions["hello"] is hello
