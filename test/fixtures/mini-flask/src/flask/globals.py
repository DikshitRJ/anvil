from __future__ import annotations

import typing as t

from .ctx import _cv_app


class _LocalProxy:
    """Proxy to an object stored in a context variable."""

    def __init__(self, name: str) -> None:
        self._name = name

    def _get(self) -> t.Any:
        try:
            ctx = _cv_app.get()
        except LookupError:
            raise RuntimeError(
                f"Working outside of application context ({self._name})."
            ) from None
        return ctx.app

    def __getattr__(self, name: str) -> t.Any:
        return getattr(self._get(), name)

    def __bool__(self) -> bool:
        try:
            self._get()
        except RuntimeError:
            return False
        return True


current_app = _LocalProxy("current_app")
request = _LocalProxy("request")
session = _LocalProxy("session")
