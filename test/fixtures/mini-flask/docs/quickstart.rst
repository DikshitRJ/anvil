Quickstart
==========

Eager to get started? This page gives a good introduction to Flask. Follow
:doc:`installation` to set up a project and install Flask first.

A Minimal Application
---------------------

A minimal Flask application looks something like this:

.. code-block:: python

    from flask import Flask

    app = Flask(__name__)

    @app.route("/")
    def hello_world():
        return "<p>Hello, World!</p>"

Debug Mode
----------

The ``flask run`` command can do more than just start the development server.
By enabling debug mode, the server will automatically reload if code changes,
and will show an interactive debugger in the browser if an error occurs
during a request.

Routing
-------

Use the :meth:`~flask.Flask.route` decorator to bind a function to a URL.

Rendering Templates
-------------------

Generating HTML from within Python is not fun. Flask configures the Jinja2
template engine for you automatically; use :func:`~flask.render_template`.

Sessions
--------

In addition to the request object there is also a second object called
:class:`session` which allows you to store information specific to a user from
one request to the next. Set the ``SECRET_KEY`` config first.
