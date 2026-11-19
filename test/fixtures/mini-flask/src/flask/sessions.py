from __future__ import annotations

import hashlib
import typing as t
from collections.abc import MutableMapping


class SessionMixin(MutableMapping):  # type: ignore[type-arg]
    """Expands a basic dictionary with session attributes."""

    @property
    def permanent(self) -> bool:
        """This reflects the ``'_permanent'`` key in the dict."""
        return self.get("_permanent", False)

    @permanent.setter
    def permanent(self, value: bool) -> None:
        self["_permanent"] = bool(value)

    new = False
    modified = True
    accessed = True


class SecureCookieSession(dict, SessionMixin):  # type: ignore[type-arg]
    """Base class for sessions based on signed cookies."""

    def __init__(self, initial=None):
        def on_update(self):
            self.modified = True
            self.accessed = True

        super().__init__(initial or ())

    def __getitem__(self, key: str) -> t.Any:
        self.accessed = True
        return super().__getitem__(key)


class SessionInterface:
    """The basic interface you have to implement when you want to replace
    the built-in session management.
    """

    null_session_class = SecureCookieSession

    def open_session(self, app, request):
        """Called at the beginning of each request to load the session."""
        raise NotImplementedError()

    def save_session(self, app, session, response):
        """Called at the end of the request to persist the session."""
        raise NotImplementedError()


class SecureCookieSessionInterface(SessionInterface):
    """The default session interface that stores sessions in signed cookies."""

    salt = "cookie-session"
    digest_method = staticmethod(hashlib.sha1)
    key_derivation = "hmac"
    session_class = SecureCookieSession

    def get_signing_serializer(self, app):
        """Build the signing serializer from the app SECRET_KEY."""
        if not app.config["SECRET_KEY"]:
            return None
        return (app.config["SECRET_KEY"], self.salt)
