# Generated manually to seed cancellation reasons

from django.db import migrations


def seed_cancellation_reasons(apps, schema_editor):
    CancellationReason = apps.get_model('config', 'CancellationReason')
    
    reasons = [
        {
            'code': 'GUEST_REQ',
            'name': 'Guest Request',
            'description': 'Cancelled at guest request',
            'sort_order': 10,
            'is_active': True
        },
        {
            'code': 'NO_SHOW',
            'name': 'No Show',
            'description': 'Guest did not arrive for appointment',
            'sort_order': 20,
            'is_active': True
        },
        {
            'code': 'STAFF_UNAVAIL',
            'name': 'Staff Unavailable',
            'description': 'Staff member became unavailable',
            'sort_order': 30,
            'is_active': True
        },
        {
            'code': 'OTHER',
            'name': 'Other',
            'description': 'Other reason',
            'sort_order': 40,
            'is_active': True
        }
    ]
    
    for reason_data in reasons:
        CancellationReason.objects.get_or_create(
            code=reason_data['code'],
            defaults=reason_data
        )


def reverse_seed_cancellation_reasons(apps, schema_editor):
    CancellationReason = apps.get_model('config', 'CancellationReason')
    CancellationReason.objects.filter(
        code__in=['GUEST_REQ', 'NO_SHOW', 'STAFF_UNAVAIL', 'OTHER']
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('config', '0002_cancellationreason'),
    ]

    operations = [
        migrations.RunPython(seed_cancellation_reasons, reverse_seed_cancellation_reasons),
    ]
