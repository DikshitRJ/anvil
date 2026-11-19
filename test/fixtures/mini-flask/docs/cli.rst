.. currentmodule:: flask

Command Line Interface
======================

Installing Flask installs the ``flask`` script, a `Click`_ command line
interface, in your virtualenv. Executed from the terminal, this script gives
access to built-in, extension, and application-defined commands. The ``--help``
option will give more information about any commands and options.

.. _Click: https://click.palletsprojects.com/


Application Discovery
---------------------

The ``flask`` command is installed by Flask, not your application; it must be
told where to find your application in order to use it. The ``--app`` option is
used to specify how to load the application.

While ``--app`` supports a variety of options for specifying your application,
most use cases should be simple. Here are the typical values:

(nothing)
    The name "app" or "wsgi" is imported (as a ".py" file, or package),
    automatically detecting an app (``app`` or ``application``) or factory
    (``create_app`` or ``make_app``).


Built-in Commands
-----------------

Flask ships with a few commands that are available in every project. They are
listed by ``flask --help`` alongside any commands added by extensions or the
application itself.

``flask run``
    Run a local development server. See :ref:`Run the Development Server
    <run-the-development-server>`.

``flask shell``
    Open an interactive Python shell in the application context. See
    :ref:`Open a Shell <open-a-shell>`.

``flask routes``
    Show all registered routes with their endpoints and methods. Use
    ``--sort`` to change the ordering and ``--all-methods`` to include HEAD
    and OPTIONS.


Run the Development Server
--------------------------

The :func:`run <cli.run_command>` command will start the development server. It
replaces the :meth:`Flask.run` method in most cases. ::

    $ flask --app hello run
     * Serving Flask app "hello"
     * Running on http://127.0.0.1:5000/ (Press CTRL+C to quit)

.. warning:: Do not use this command to run your application in production.
    Only use the development server during development.


Open a Shell
------------

To explore the data in your application, you can start an interactive Python
shell with the :func:`shell <cli.shell_command>` command. An application
context will be active, and the app instance will be imported. ::

    $ flask shell
    Python 3.10.0 on linux
    App: example [production]
    >>>


Custom Commands
---------------

The ``flask`` command is implemented using `Click`_. See that project's
documentation for full information about writing commands.

This example adds the command ``create-user`` that takes the argument
``name``. ::

    import click
    from flask import Flask

    app = Flask(__name__)

    @app.cli.command("create-user")
    @click.argument("name")
    def create_user(name):
        ...
