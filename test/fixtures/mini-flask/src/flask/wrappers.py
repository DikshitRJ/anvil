from __future__ import annotations

import typing as t


class Request:
    """The request object used by default in Flask. Remembers the matched
    endpoint and view arguments.
    """

    json_module: t.Any = None
    url_rule: t.Any = None
    view_args: dict[str, t.Any] | None = None

    @property
    def endpoint(self) -> str | None:
        """The endpoint that matched the request URL."""
        if self.url_rule is not None:
            return self.url_rule.endpoint
        return None

    @property
    def blueprint(self) -> str | None:
        """The registered name of the current blueprint."""
        endpoint = self.endpoint
        if endpoint is not None and "." in endpoint:
            return endpoint.rpartition(".")[0]
        return None


class Response:
    """The response object that is used by default in Flask."""

    default_mimetype: str | None = "text/html"
    json_module: t.Any = None
    autocorrect_location_header = False

    def __init__(self, body: t.Any = "", status: int = 200, mimetype: str | None = None):
        self.body = body
        self.status = status
        self.mimetype = mimetype or self.default_mimetype

    @property
    def max_cookie_size(self) -> int:
        """Read-only view of the ``MAX_COOKIE_SIZE`` config key."""
        return 4093
