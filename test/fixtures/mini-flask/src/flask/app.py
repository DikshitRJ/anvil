from __future__ import annotations

import os
import typing as t

import click

from .cli import AppGroup
from .config import Config
from .ctx import AppContext
from .globals import current_app
from .helpers import get_debug_flag
from .json.provider import DefaultJSONProvider
from .sessions import SecureCookieSessionInterface
from .templating import Environment
from .wrappers import Request
from .wrappers import Response


class Flask:
    """The flask object implements a WSGI application and acts as the central
    object. It is passed the name of the module or package of the application.
    """

    request_class = Request
    response_class = Response
    json_provider_class = DefaultJSONProvider
    session_interface = SecureCookieSessionInterface()

    default_config = {
        "DEBUG": None,
        "TESTING": False,
        "SECRET_KEY": None,
        "SESSION_COOKIE_NAME": "session",
        "MAX_CONTENT_LENGTH": None,
        "JSON_SORT_KEYS": True,
    }

    def __init__(self, import_name: str, static_folder: str | None = "static"):
        self.import_name = import_name
        self.static_folder = static_folder
        self.config = Config(os.getcwd(), self.default_config)
        self.config["DEBUG"] = get_debug_flag()
        self.json = self.json_provider_class(self)
        self.cli = AppGroup()
        self.url_map = None
        self.view_functions: dict[str, t.Callable[..., t.Any]] = {}
        self.jinja_env = Environment(self)

    @property
    def debug(self) -> bool:
        """Whether debug mode is enabled."""
        return self.config["DEBUG"]

    @debug.setter
    def debug(self, value: bool) -> None:
        self.config["DEBUG"] = value

    def app_context(self) -> AppContext:
        """Create an application context."""
        return AppContext(self)

    def route(self, rule: str, **options: t.Any):
        """Decorate a view function to register it with the given URL rule."""

        def decorator(f):
            endpoint = options.pop("endpoint", f.__name__)
            self.add_url_rule(rule, endpoint, f, **options)
            return f

        return decorator

    def add_url_rule(self, rule: str, endpoint: str, view_func=None, **options):
        """Connect a URL rule to a view function."""
        self.view_functions[endpoint] = view_func

    def make_response(self, rv):
        """Convert the return value from a view function to an instance of response_class."""
        if isinstance(rv, self.response_class):
            return rv
        return self.response_class(rv)

    def run(self, host: str | None = None, port: int | None = None, debug: bool | None = None):
        """Runs the application on a local development server."""
        if debug is not None:
            self.debug = debug
        click.echo(f" * Serving Flask app {self.import_name!r}")

    def test_client(self):
        """Creates a test client for this application."""
        from .testing import FlaskClient

        return FlaskClient(self)

    def test_cli_runner(self, **kwargs):
        """Create a CLI runner for testing CLI commands."""
        from .testing import FlaskCliRunner

        return FlaskCliRunner(self, **kwargs)
