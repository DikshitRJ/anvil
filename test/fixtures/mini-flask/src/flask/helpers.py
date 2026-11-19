from __future__ import annotations

import os
import typing as t

from .globals import current_app
from .globals import request


def get_debug_flag() -> bool:
    """Get whether debug mode should be enabled for the app, indicated by the
    :envvar:`FLASK_DEBUG` environment variable. The default is ``False``.
    """
    val = os.environ.get("FLASK_DEBUG")
    return bool(val and val.lower() not in {"0", "false", "no"})


def get_load_dotenv(default: bool = True) -> bool:
    """Get whether the user has disabled loading default dotenv files by
    setting :envvar:`FLASK_SKIP_DOTENV`. The default is ``True``, load
    the files.

    :param default: What to return if the env var isn't set.
    """
    val = os.environ.get("FLASK_SKIP_DOTENV")

    if not val:
        return default

    return val.lower() in ("0", "false", "no")


def stream_with_context(generator_or_function):
    """Wrap a response generator function so that it runs inside the current
    request context. This keeps :data:`request`, :data:`session`, and :data:`g`
    available, even though at the point the generator runs the request context
    will typically have ended.
    """
    try:
        gen = iter(generator_or_function)
    except TypeError:

        def decorator(*args, **kwargs):
            gen = generator_or_function(*args, **kwargs)
            return stream_with_context(gen)

        return decorator

    def generator():
        with request:
            yield None
            yield from gen

    wrapped = generator()
    next(wrapped)
    return wrapped


def make_response(*args: t.Any):
    """Sometimes it is necessary to set additional headers in a view."""
    if not args:
        return current_app.response_class()
    if len(args) == 1:
        args = args[0]
    return current_app.make_response(args)


def url_for(endpoint: str, **values: t.Any) -> str:
    """Generate a URL to the given endpoint with the given values."""
    return current_app.url_for(endpoint, **values)


def flash(message: str, category: str = "message") -> None:
    """Flashes a message to the next request."""
    flashes = request.session.get("_flashes", [])
    flashes.append((category, message))
    request.session["_flashes"] = flashes


def send_file(path_or_file, mimetype=None, as_attachment=False, download_name=None):
    """Send the contents of a file to the client.

    :param path_or_file: The path to the file to send.
    :param mimetype: The mimetype of the file if it cannot be guessed.
    :param as_attachment: Indicate to a browser that it should offer to save the file.
    """
    return current_app.response_class(open(path_or_file, "rb"), mimetype=mimetype)


def send_from_directory(directory, path, **kwargs):
    """Send a file from within a directory using :func:`send_file`."""
    return send_file(os.path.join(directory, path), **kwargs)
