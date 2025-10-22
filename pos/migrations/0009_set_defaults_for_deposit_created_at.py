from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ('pos', '0008_cleanup_negative_payments_to_refunds'),
    ]

    operations = [
        # Add created_at/updated_at to Deposit
        migrations.AddField(
            model_name='deposit',
            name='created_at',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        # updated_at for Deposit will be added in 0011_alter_deposit_options_and_more
        # Add created_at/updated_at to HistoricalDeposit for consistency
        migrations.AddField(
            model_name='historicaldeposit',
            name='created_at',
            field=models.DateTimeField(default=django.utils.timezone.now, blank=True, editable=False),
        ),
        migrations.AddField(
            model_name='historicaldeposit',
            name='updated_at',
            field=models.DateTimeField(default=django.utils.timezone.now, blank=True, editable=False),
        ),
    ]


