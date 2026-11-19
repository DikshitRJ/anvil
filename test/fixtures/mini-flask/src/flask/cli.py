from __future__ import annotations

import os
import sys
import typing as t
from functools import update_wrapper
from importlib import metadata

import click

from .globals import current_app
from .helpers import get_debug_flag
from .helpers import get_load_dotenv

if t.TYPE_CHECKING:
    from .app import Flask


class NoAppException(click.UsageError):
    """Raised if an application cannot be found or loaded."""


def find_best_app(module):
    """Given a module instance this tries to find the best possible
    application in the module or raises an exception.
    """
    from . import Flask

    for attr_name in ("app", "application"):
        app = getattr(module, attr_name, None)
        if isinstance(app, Flask):
            return app

    raise NoAppException(f"Failed to find Flask application in {module.__name__!r}.")


class ScriptInfo:
    """Helper object to deal with Flask applications. This is usually not
    necessary to interface with as it's used internally in the dispatching
    to click.
    """

    def __init__(self, app_import_path=None, create_app=None, set_debug_flag=True):
        self.app_import_path = app_import_path
        self.create_app = create_app
        self.data: dict[t.Any, t.Any] = {}
        self.set_debug_flag = set_debug_flag
        self._loaded_app: Flask | None = None

    def load_app(self) -> Flask:
        """Loads the Flask app (if not yet loaded) and returns it."""
        if self._loaded_app is not None:
            return self._loaded_app

        if self.create_app is not None:
            app = self.create_app()
        else:
            app = find_best_app(__import__(self.app_import_path or "app"))

        if self.set_debug_flag:
            app.debug = get_debug_flag()

        self._loaded_app = app
        return app


pass_script_info = click.make_pass_decorator(ScriptInfo, ensure=True)


def with_appcontext(f):
    """Wraps a callback so that it's guaranteed to be executed with the
    script's application context.
    """

    @click.pass_context
    def decorator(ctx, /, *args, **kwargs):
        if not current_app:
            app = ctx.ensure_object(ScriptInfo).load_app()
            ctx.with_resource(app.app_context())

        return ctx.invoke(f, *args, **kwargs)

    return update_wrapper(decorator, f)


class AppGroup(click.Group):
    """This works similar to a regular click Group but it changes
    the behavior of the command decorator so that it automatically
    wraps the functions in with_appcontext.
    """

    def command(self, *args, **kwargs):
        wrap_for_ctx = kwargs.pop("with_appcontext", True)

        def decorator(f):
            if wrap_for_ctx:
                f = with_appcontext(f)
            return super(AppGroup, self).command(*args, **kwargs)(f)

        return decorator


def _load_plugin_commands():
    for ep in metadata.entry_points(group="flask.commands"):
        yield ep


class FlaskGroup(AppGroup):
    """Special subclass of the AppGroup group that supports loading more
    commands from the configured Flask app. Normally a developer does not
    have to interface with this class but there are some very advanced
    use cases for which it makes sense to create an instance of this.
    """

    def __init__(
        self,
        add_default_commands=True,
        create_app=None,
        add_version_option=True,
        load_dotenv=True,
        set_debug_flag=True,
        **extra,
    ):
        params = list(extra.pop("params", None) or ())
        super().__init__(params=params, **extra)
        self.create_app = create_app
        self.load_dotenv = load_dotenv
        self.set_debug_flag = set_debug_flag

        if add_default_commands:
            self.add_command(run_command)
            self.add_command(shell_command)
            self.add_command(routes_command)

        self._loaded_plugin_commands = False

    def _load_plugin_commands(self):
        if self._loaded_plugin_commands:
            return

        for ep in _load_plugin_commands():
            self.add_command(ep.load(), ep.name)

        self._loaded_plugin_commands = True

    def get_command(self, ctx, name):
        self._load_plugin_commands()
        rv = super().get_command(ctx, name)

        if rv is not None:
            return rv

        info = ctx.ensure_object(ScriptInfo)

        try:
            app = info.load_app()
        except NoAppException as e:
            click.echo(f"Error: {e.format_message()}\n", err=True)
            return None

        return app.cli.get_command(ctx, name)

    def list_commands(self, ctx):
        self._load_plugin_commands()
        rv = set(super().list_commands(ctx))
        info = ctx.ensure_object(ScriptInfo)

        try:
            rv.update(info.load_app().cli.list_commands(ctx))
        except NoAppException as e:
            click.echo(f"Error: {e.format_message()}\n", err=True)

        return sorted(rv)

    def make_context(self, info_name, args, parent=None, **extra):
        if get_load_dotenv(self.load_dotenv):
            load_dotenv()

        if "obj" not in extra and "obj" not in self.context_settings:
            extra["obj"] = ScriptInfo(
                create_app=self.create_app, set_debug_flag=self.set_debug_flag
            )

        return super().make_context(info_name, args, parent=parent, **extra)


@click.command("run", short_help="Run a development server.")
@click.option("--host", "-h", default="127.0.0.1", help="The interface to bind to.")
@click.option("--port", "-p", default=5000, help="The port to bind to.")
@click.option("--debug/--no-debug", default=None, help="Enable or disable debug mode.")
@pass_script_info
def run_command(info, host, port, debug):
    """Run a local development server.

    This server is for development purposes only. It does not provide
    the stability, security, or performance of production WSGI servers.
    """
    app = info.load_app()
    app.run(host=host, port=port, debug=debug)


@click.command("shell", short_help="Run a shell in the app context.")
@with_appcontext
def shell_command() -> None:
    """Run an interactive Python shell in the context of a given
    Flask application. The application will populate the default
    namespace of this shell according to its configuration.
    """
    import code

    banner = f"Python {sys.version} on {sys.platform}\nApp: {current_app.import_name}"
    code.interact(banner=banner, local={"app": current_app})


@click.command("routes", short_help="Show the routes for the app.")
@click.option(
    "--sort",
    "-s",
    type=click.Choice(("endpoint", "methods", "domain", "rule", "match")),
    default="endpoint",
    help="Method to sort routes by.",
)
@click.option("--all-methods", is_flag=True, help="Show HEAD and OPTIONS methods.")
@with_appcontext
def routes_command(sort: str, all_methods: bool) -> None:
    """Show all registered routes with endpoints and methods."""
    rules = list(current_app.url_map.iter_rules())

    if not rules:
        click.echo("No routes were registered.")
        return

    rows = [(r.endpoint, ", ".join(sorted(r.methods or ())), r.rule) for r in rules]
    rows.sort(key=lambda r: r[0])
    for endpoint, methods, rule in rows:
        click.echo(f"{endpoint:30} {methods:20} {rule}")


cli = FlaskGroup(
    name="flask",
    help="""\
A general utility script for Flask applications.

An application to load must be given with the '--app' option,
'FLASK_APP' environment variable, or with a 'wsgi.py' or 'app.py' file
in the current directory.
""",
)


def main() -> None:
    cli.main()


if __name__ == "__main__":
    main()
