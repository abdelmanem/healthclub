from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reservations', '0010_add_missing_housekeeping_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='historicalhousekeepingtask',
            name='created_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
    ]


