from django.core.management.base import BaseCommand
from django.db import connection


LOCK_QUERY = """
SELECT
  a.pid,
  a.usename,
  a.application_name,
  a.query as blocked_query,
  pg_blocking_pids(a.pid) as blocked_by,
  a.state,
  now() - a.query_start as running_for
FROM pg_stat_activity a
WHERE cardinality(pg_blocking_pids(a.pid)) > 0
ORDER BY running_for DESC;
"""


class Command(BaseCommand):
    help = 'Show PostgreSQL sessions that are blocked and who is blocking them'

    def handle(self, *args, **options):
        with connection.cursor() as cur:
            cur.execute(LOCK_QUERY)
            rows = cur.fetchall()
        if not rows:
            self.stdout.write(self.style.SUCCESS('No blocking locks detected'))
            return
        headers = ['pid', 'user', 'app', 'blocked_query', 'blocked_by', 'state', 'running_for']
        self.stdout.write('\t'.join(headers))
        for row in rows:
            self.stdout.write('\t'.join([str(c) for c in row]))


