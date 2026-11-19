from __future__ import annotations

import typing as t

from .globals import current_app


class Environment:
    """Works like a regular Jinja environment but has some additional
    knowledge of how Flask's blueprint works so that it can prepend the
    name of the blueprint to referenced templates if necessary.
    """

    def __init__(self, app, **options: t.Any):
        options.setdefault("autoescape", True)
        self.app = app
        self.options = options

    def get_template(self, name: str):
        """Load a template by name."""
        return (self.app, name)


def render_template(template_name_or_list: str, **context: t.Any) -> str:
    """Render a template by name with the given context."""
    app = current_app
    template = app.jinja_env.get_template(template_name_or_list)
    return f"{template}:{context}"


def render_template_string(source: str, **context: t.Any) -> str:
    """Render a template from the given source string with the given context."""
    return source.format(**context)
