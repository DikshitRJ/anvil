from __future__ import annotations

import json as _json
import typing as t

from ..globals import current_app


def dumps(obj: t.Any, **kwargs: t.Any) -> str:
    """Serialize data as JSON using the current app's JSON provider."""
    return current_app.json.dumps(obj, **kwargs)


def loads(s: str | bytes, **kwargs: t.Any) -> t.Any:
    """Deserialize data as JSON using the current app's JSON provider."""
    return current_app.json.loads(s, **kwargs)


def jsonify(*args: t.Any, **kwargs: t.Any):
    """Serialize the given arguments as JSON, and return a response object
    with the ``application/json`` mimetype.
    """
    return current_app.json.response(*args, **kwargs)
