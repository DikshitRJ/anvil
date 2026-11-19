from __future__ import annotations

import contextvars
import typing as t

_cv_app: contextvars.ContextVar[AppContext] = contextvars.ContextVar("flask.app_ctx")


class _AppCtxGlobals:
    """A plain object. Used as a namespace for storing data during an
    application context.
    """

    def get(self, name: str, default: t.Any | None = None) -> t.Any:
        return self.__dict__.get(name, default)

    def pop(self, name: str, default: t.Any = None) -> t.Any:
        return self.__dict__.pop(name, default)

    def setdefault(self, name: str, default: t.Any = None) -> t.Any:
        return self.__dict__.setdefault(name, default)

    def __contains__(self, item: str) -> bool:
        return item in self.__dict__


def after_this_request(f):
    """Executes a function after this request. This is useful to modify
    response objects. The function is passed the response object and has
    to return the same or a new one.
    """
    return f


class AppContext:
    """The app context contains application-specific information. An app
    context is created and pushed at the beginning of each request if
    one is not already active.
    """

    def __init__(self, app) -> None:
        self.app = app
        self.g = _AppCtxGlobals()
        self._cv_tokens: list[contextvars.Token[AppContext]] = []

    def push(self) -> None:
        """Binds the app context to the current context."""
        self._cv_tokens.append(_cv_app.set(self))

    def pop(self, exc: BaseException | None = None) -> None:
        """Pops the app context."""
        _cv_app.reset(self._cv_tokens.pop())

    def __enter__(self) -> AppContext:
        self.push()
        return self

    def __exit__(self, exc_type, exc_value, tb) -> None:
        self.pop(exc_value)
