# Generated manually for adding gender, is_clean, is_occupied to Location

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reservations', '0006_locationstatus_locationtype_historicallocationstatus_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='location',
            name='gender',
            field=models.CharField(choices=[('male', 'Male'), ('female', 'Female'), ('unisex', 'Unisex')], default='unisex', max_length=16),
        ),
        migrations.AddField(
            model_name='location',
            name='is_clean',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='location',
            name='is_occupied',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='historicallocation',
            name='gender',
            field=models.CharField(choices=[('male', 'Male'), ('female', 'Female'), ('unisex', 'Unisex')], default='unisex', max_length=16),
        ),
        migrations.AddField(
            model_name='historicallocation',
            name='is_clean',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='historicallocation',
            name='is_occupied',
            field=models.BooleanField(default=False),
        ),
    ]

