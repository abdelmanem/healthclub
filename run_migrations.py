import os
import sys


def main() -> int:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "healthclub.settings")
    import django

    django.setup()
    from django.core.management import call_command

    call_command("makemigrations", "reservations")
    call_command("makemigrations", "guests")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


