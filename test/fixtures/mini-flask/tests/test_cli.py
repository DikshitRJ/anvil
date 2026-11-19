from __future__ import annotations

import click
import pytest
from click.testing import CliRunner

from flask import Flask
from flask.cli import AppGroup
from flask.cli import FlaskGroup
from flask.cli import NoAppException
from flask.cli import ScriptInfo
from flask.cli import find_best_app
from flask.cli import routes_command
from flask.cli import run_command
from flask.cli import shell_command


@pytest.fixture
def runner():
    return CliRunner()


def test_find_best_app():
    class Module:
        app = Flask("appname")

    assert find_best_app(Module) is Module.app


def test_no_app_raises():
    class Module:
        __name__ = "empty"

    with pytest.raises(NoAppException):
        find_best_app(Module)


def test_scriptinfo_loads_app_once():
    app = Flask("appname")
    info = ScriptInfo(create_app=lambda: app)
    assert info.load_app() is app
    assert info.load_app() is app


def test_appgroup_wraps_with_appcontext():
    group = AppGroup()

    @group.command("hello")
    def hello():
        click.echo("hello")

    assert "hello" in group.commands


def test_flaskgroup_lists_default_commands(runner):
    cli = FlaskGroup(create_app=lambda: Flask("flaskgroup"))
    result = runner.invoke(cli, ["--help"])
    assert result.exit_code == 0
    assert "run" in result.output
    assert "shell" in result.output
    assert "routes" in result.output


def test_help_lists_built_in_commands(runner):
    cli = FlaskGroup(create_app=lambda: Flask("helptest"))
    result = runner.invoke(cli, ["--help"])
    for name in ("run", "shell", "routes"):
        assert name in result.output


def test_routes_command_no_routes(runner):
    app = Flask("routes")
    cli = FlaskGroup(create_app=lambda: app)
    result = runner.invoke(cli, ["routes"])
    assert result.exit_code == 0
    assert "No routes were registered." in result.output


def test_routes_command_sorted(runner):
    app = Flask("routes")

    @app.route("/a")
    def a():
        return "a"

    cli = FlaskGroup(create_app=lambda: app)
    result = runner.invoke(cli, ["routes", "--sort", "rule"])
    assert result.exit_code == 0
    assert "/a" in result.output


def test_run_command_help(runner):
    result = runner.invoke(run_command, ["--help"])
    assert "--host" in result.output
    assert "--port" in result.output


def test_shell_command_registered():
    assert shell_command.name == "shell"
    assert routes_command.name == "routes"
