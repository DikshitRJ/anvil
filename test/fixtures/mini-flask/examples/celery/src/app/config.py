"""Example app configuration for a celery demo; prints the app config."""
from flask import Flask

app = Flask(__name__)
app.config.from_mapping(CELERY={"broker_url": "redis://localhost"})


def show_app_config():
    print(app.config)
