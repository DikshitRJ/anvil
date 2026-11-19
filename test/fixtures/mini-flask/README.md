# Flask

Flask is a lightweight WSGI web application framework. It is designed to make
getting started quick and easy, with the ability to scale up to complex applications.

## A Simple Example

```python
from flask import Flask

app = Flask(__name__)


@app.route("/")
def hello():
    return "Hello, World!"
```

```
$ flask run
  * Running on http://127.0.0.1:5000/
```
