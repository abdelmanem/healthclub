from django.apps import AppConfig


class PosConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'pos'

    def ready(self) -> None:
        from . import signals  # noqa: F401
        return super().ready()
