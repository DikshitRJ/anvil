from __future__ import annotations

import errno
import json
import os
import typing as t


class Config(dict):  # type: ignore[type-arg]
    """Works exactly like a dict but provides ways to fill it from files
    or special dictionaries. There are two common patterns to populate the
    config.

    Either you can fill the config from a config file::

        app.config.from_pyfile('yourconfig.cfg')

    Configuration keys must be uppercase to be stored.
    """

    def __init__(self, root_path: str | os.PathLike[str], defaults: dict[str, t.Any] | None = None):
        super().__init__(defaults or {})
        self.root_path = root_path

    def from_envvar(self, variable_name: str, silent: bool = False) -> bool:
        """Loads a configuration from an environment variable pointing to
        a configuration file.

        :param variable_name: name of the environment variable
        :param silent: set to ``True`` if you want silent failure for missing files.
        :return: ``True`` if the file was loaded successfully.
        """
        rv = os.environ.get(variable_name)
        if not rv:
            if silent:
                return False
            raise RuntimeError(f"The environment variable {variable_name!r} is not set.")
        return self.from_pyfile(rv, silent=silent)

    def from_pyfile(self, filename: str, silent: bool = False) -> bool:
        """Updates the values in the config from a Python file."""
        filename = os.path.join(self.root_path, filename)
        d = {"__file__": filename}
        try:
            with open(filename, mode="rb") as config_file:
                exec(compile(config_file.read(), filename, "exec"), d)
        except OSError as e:
            if silent and e.errno in (errno.ENOENT, errno.EISDIR, errno.ENOTDIR):
                return False
            raise
        self.from_object(d)
        return True

    def from_object(self, obj: object | str) -> None:
        """Updates the values from the given object."""
        for key in dir(obj):
            if key.isupper():
                self[key] = getattr(obj, key)

    def from_file(self, filename: str, load=json.load, silent: bool = False) -> bool:
        """Update the values in the config from a file that is loaded using the load parameter."""
        filename = os.path.join(self.root_path, filename)
        with open(filename) as f:
            obj = load(f)
        return self.from_mapping(obj)

    def from_mapping(self, mapping: t.Mapping[str, t.Any] | None = None, **kwargs: t.Any) -> bool:
        """Updates the config like :meth:`update` ignoring items with
        non-upper keys.
        """
        mappings: dict[str, t.Any] = {}
        if mapping is not None:
            mappings.update(mapping)
        mappings.update(kwargs)
        for key, value in mappings.items():
            if key.isupper():
                self[key] = value
        return True

    def get_namespace(self, namespace: str, lowercase: bool = True, trim_namespace: bool = True):
        """Returns a dictionary containing a subset of configuration options
        that match the specified namespace/prefix.
        """
        rv = {}
        for k, v in self.items():
            if not k.startswith(namespace):
                continue
            key = k[len(namespace) :] if trim_namespace else k
            rv[key.lower() if lowercase else key] = v
        return rv

    def __repr__(self) -> str:
        return f"<{type(self).__name__} {dict.__repr__(self)}>"
