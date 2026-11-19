Tutorial
========

.. toctree::
    :caption: Contents:
    :maxdepth: 1

    layout
    factory
    database

This tutorial will walk you through creating a basic blog application
called Flaskr. Users will be able to register, log in, create posts, and
edit or delete their own posts.

Project Layout
--------------

Create a project directory and enter it. The Flaskr package contains the
application factory, views, templates and static files.

The Application Factory
-----------------------

Instead of creating a Flask instance globally, you will create it inside a
function. This function is known as the application factory.
