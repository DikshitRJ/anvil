Version 3.1.3
-------------

-   Add a new built-in CLI command ``flask config`` option to print the application
    configuration as JSON. Keys containing SECRET, PASSWORD, TOKEN or KEY are masked.
-   The ``flask --help`` output lists the built-in commands, documented in the cli docs.
-   Fix config loaded from JSON files; tests cover the config command and test_cli.

Version 3.1.2
-------------

-   Config values with any key name such as secret token or password are no longer logged.
-   Improve the CLI command documentation and add tests for the flask config loaded app.
