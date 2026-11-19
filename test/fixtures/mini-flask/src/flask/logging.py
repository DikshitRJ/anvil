from __future__ import annotations

import logging
import sys
import typing as t

default_handler = logging.StreamHandler(sys.stderr)
default_handler.setFormatter(
    logging.Formatter("[%(asctime)s] %(levelname)s in %(module)s: %(message)s")
)


def has_level_handler(logger: logging.Logger) -> bool:
    """Check if there is a handler in the logging chain that will handle the
    given logger's effective level.
    """
    level = logger.getEffectiveLevel()
    current: t.Optional[logging.Logger] = logger

    while current:
        if any(handler.level <= level for handler in current.handlers):
            return True
        if not current.propagate:
            break
        current = current.parent

    return False


def create_logger(app) -> logging.Logger:
    """Get the Flask app's logger and configure it if needed."""
    logger = logging.getLogger(app.name)

    if app.debug and not logger.level:
        logger.setLevel(logging.DEBUG)

    if not has_level_handler(logger):
        logger.addHandler(default_handler)

    return logger
