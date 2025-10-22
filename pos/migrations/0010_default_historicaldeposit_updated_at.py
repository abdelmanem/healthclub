from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ('pos', '0009_set_defaults_for_deposit_created_at'),
    ]

    operations = [
        migrations.AlterField(
            model_name='historicaldeposit',
            name='updated_at',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
    ]


