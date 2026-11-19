from __future__ import annotations

import os

import pytest

from flask import Flask
from flask import Config

TEST_KEY = "foo"
SECRET_KEY = "config"


def common_object_test(app):
    assert app.secret_key == "config"
    assert app.config["TEST_KEY"] == "foo"
    assert "TestConfig" not in app.config


def test_config_from_mapping():
    app = Flask(__name__)
    app.config.from_mapping({"SECRET_KEY": "config", "TEST_KEY": "foo"})
    common_object_test(app)


def test_config_from_envvar(monkeypatch):
    monkeypatch.setattr("os.environ", {})
    app = Flask(__name__)
    with pytest.raises(RuntimeError) as e:
        app.config.from_envvar("FOO_SETTINGS")
        assert "'FOO_SETTINGS' is not set" in str(e.value)
    assert not app.config.from_envvar("FOO_SETTINGS", silent=True)


def test_config_ignores_lowercase_keys():
    config = Config(os.getcwd())
    config.from_mapping({"lower": 1, "UPPER": 2})
    assert "lower" not in config
    assert config["UPPER"] == 2


def test_get_namespace():
    app = Flask(__name__)
    app.config["IMAGE_STORE_TYPE"] = "fs"
    app.config["IMAGE_STORE_PATH"] = "/var/app/images"
    ns = app.config.get_namespace("IMAGE_STORE_")
    assert ns == {"type": "fs", "path": "/var/app/images"}
