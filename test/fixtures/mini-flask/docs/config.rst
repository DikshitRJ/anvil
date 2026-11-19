.. currentmodule:: flask

Configuration Handling
======================

Applications need some kind of configuration. There are different settings
you might want to change depending on the application environment like
toggling the debug mode, setting the secret key, and other such
environment-specific things.

Configuration Basics
--------------------

The :attr:`~flask.Flask.config` is actually a subclass of a dictionary and
can be modified just like any dictionary::

    app = Flask(__name__)
    app.config['TESTING'] = True

Debug Mode
----------

The :data:`DEBUG` config value is special because it may behave inconsistently if
changed after the app has begun setting up. In order to set debug mode reliably, use the
``--debug`` option on the ``flask`` or ``flask run`` command, or set the
``FLASK_DEBUG`` environment variable.

Builtin Configuration Values
----------------------------

The following configuration values are used internally by Flask:

.. py:data:: SECRET_KEY

    A secret key that will be used for securely signing the session cookie
    and can be used for any other security related needs by extensions or your
    application. It should be a long random ``bytes`` or ``str``.

.. py:data:: SESSION_COOKIE_NAME

    The name of the session cookie. Can be changed in case you already have a
    cookie with the same name.

.. py:data:: MAX_CONTENT_LENGTH

    Don't read more than this many bytes from the incoming request data.

Configuring from Environment Variables
--------------------------------------

In addition to pointing to configuration files using environment variables, you
may find it useful (or necessary) to control your configuration values directly
from the environment. Use :meth:`~flask.Config.from_envvar` or
:meth:`~flask.Config.from_mapping` to load values.
