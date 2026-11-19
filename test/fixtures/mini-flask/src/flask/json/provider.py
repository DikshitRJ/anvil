from __future__ import annotations

import dataclasses
import datetime
import decimal
import json
import typing as t
import uuid


class JSONProvider:
    """A standard set of JSON operations for an application. Subclasses
    of this can be used to customize JSON behavior or use different
    JSON libraries.
    """

    def __init__(self, app) -> None:
        self._app = app

    def dumps(self, obj: t.Any, **kwargs: t.Any) -> str:
        """Serialize data as JSON."""
        raise NotImplementedError

    def loads(self, s: str | bytes, **kwargs: t.Any) -> t.Any:
        """Deserialize data as JSON."""
        raise NotImplementedError

    def response(self, *args: t.Any, **kwargs: t.Any):
        """Serialize the given arguments as JSON, and return a response object."""
        obj = args[0] if len(args) == 1 else args
        return self._app.response_class(self.dumps(obj), mimetype="application/json")


def _default(o: t.Any) -> t.Any:
    if isinstance(o, datetime.date):
        return o.isoformat()
    if isinstance(o, (decimal.Decimal, uuid.UUID)):
        return str(o)
    if dataclasses and dataclasses.is_dataclass(o):
        return dataclasses.asdict(o)
    raise TypeError(f"Object of type {type(o).__name__} is not JSON serializable")


class DefaultJSONProvider(JSONProvider):
    """Provide JSON operations using Python's built-in :mod:`json` library."""

    default = staticmethod(_default)
    ensure_ascii = True
    sort_keys = True
    compact: bool | None = None

    def dumps(self, obj: t.Any, **kwargs: t.Any) -> str:
        kwargs.setdefault("default", self.default)
        kwargs.setdefault("ensure_ascii", self.ensure_ascii)
        kwargs.setdefault("sort_keys", self.sort_keys)
        return json.dumps(obj, **kwargs)

    def loads(self, s: str | bytes, **kwargs: t.Any) -> t.Any:
        return json.loads(s, **kwargs)
