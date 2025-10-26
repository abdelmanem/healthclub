# Discount System Implementation Guide

## 🎯 **Overview**

This guide provides step-by-step instructions for implementing the comprehensive discount system in your health club management application. The system includes:

- **Multiple discount types**: Percentage, fixed amount, and free service discounts
- **Employee tracking**: Track which employee applied each discount
- **Reservation-level tracking**: Link discounts to specific reservations
- **Approval workflow**: Control discount application with manager approval
- **Complete audit trail**: Full history of discount applications
- **Permission-based access**: Control who can apply discounts

## 📋 **Implementation Steps**

### **Step 1: Database Setup**

1. **Run the migration**:
   ```bash
   python manage.py makemigrations discounts
   python manage.py migrate
   ```

2. **Create sample discount types**:
   ```bash
   python manage.py setup_discounts
   ```

### **Step 2: Backend Configuration**

1. **Add discounts app to INSTALLED_APPS** (already done in settings.py):
   ```python
   INSTALLED_APPS = [
       # ... other apps
       'discounts',
   ]
   ```

2. **URL configuration** (already done in urls.py):
   ```python
   router.register(r'discounts/discount-types', DiscountTypeViewSet, basename='discount-type')
   router.register(r'discounts/reservation-discounts', ReservationDiscountViewSet, basename='reservation-discount')
   router.register(r'discounts/discount-rules', DiscountRuleViewSet, basename='discount-rule')
   router.register(r'discounts/discount-application', DiscountApplicationViewSet, basename='discount-application')
   ```

### **Step 3: Permission Setup**

Create permissions for the discount system:

```bash
python manage.py shell
```

```python
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from discounts.models import DiscountType, ReservationDiscount, DiscountRule

# Get content types
discount_type_ct = ContentType.objects.get_for_model(DiscountType)
reservation_discount_ct = ContentType.objects.get_for_model(ReservationDiscount)
discount_rule_ct = ContentType.objects.get_for_model(DiscountRule)

# Create permissions
permissions = [
    ('view_discounttype', 'Can view discount type'),
    ('add_discounttype', 'Can add discount type'),
    ('change_discounttype', 'Can change discount type'),
    ('delete_discounttype', 'Can delete discount type'),
    ('view_reservationdiscount', 'Can view reservation discount'),
    ('add_reservationdiscount', 'Can add reservation discount'),
    ('change_reservationdiscount', 'Can change reservation discount'),
    ('delete_reservationdiscount', 'Can delete reservation discount'),
    ('view_discountrule', 'Can view discount rule'),
    ('add_discountrule', 'Can add discount rule'),
    ('change_discountrule', 'Can change discount rule'),
    ('delete_discountrule', 'Can delete discount rule'),
    ('apply_discount', 'Can apply discount'),
    ('approve_discount', 'Can approve discount'),
]

for codename, name in permissions:
    Permission.objects.get_or_create(
        codename=codename,
        name=name,
        content_type=discount_type_ct if 'discounttype' in codename else 
                   reservation_discount_ct if 'reservationdiscount' in codename else
                   discount_rule_ct if 'discountrule' in codename else discount_type_ct
    )
```

### **Step 4: Frontend Integration**

The frontend integration is already implemented in the ReservationBookingForm component. Key features include:

1. **Discount Selection**: Users can view available discounts and apply them
2. **Discount Preview**: Shows calculated savings before applying
3. **Approval Workflow**: Handles discounts that require manager approval
4. **Applied Discounts**: Shows all applied discounts with ability to remove them
5. **Price Calculation**: Updates total price with discount amounts

### **Step 5: Testing the System**

1. **Create a test reservation** with services
2. **Apply different discount types**:
   - Percentage discounts (e.g., First Time Guest - 20% off)
   - Fixed amount discounts (e.g., Bulk Booking - $5 off)
   - Free service discounts (e.g., VIP Member)
3. **Test approval workflow** for discounts requiring approval
4. **Verify discount tracking** in the admin interface

## 🔧 **API Endpoints**

### **Discount Types**
- `GET /api/discounts/discount-types/` - List all discount types
- `POST /api/discounts/discount-types/` - Create new discount type
- `GET /api/discounts/discount-types/{id}/` - Get specific discount type
- `PATCH /api/discounts/discount-types/{id}/` - Update discount type
- `DELETE /api/discounts/discount-types/{id}/` - Delete discount type
- `GET /api/discounts/discount-types/{id}/usage-stats/` - Get usage statistics

### **Reservation Discounts**
- `GET /api/discounts/reservation-discounts/` - List applied discounts
- `POST /api/discounts/reservation-discounts/` - Apply discount to reservation
- `GET /api/discounts/reservation-discounts/{id}/` - Get specific discount
- `PATCH /api/discounts/reservation-discounts/{id}/` - Update discount
- `DELETE /api/discounts/reservation-discounts/{id}/` - Delete discount
- `POST /api/discounts/reservation-discounts/{id}/approve/` - Approve pending discount
- `POST /api/discounts/reservation-discounts/{id}/reject/` - Reject pending discount
- `POST /api/discounts/reservation-discounts/{id}/cancel/` - Cancel applied discount

### **Discount Application**
- `POST /api/discounts/discount-application/apply/` - Apply discount to reservation

### **Discount Rules**
- `GET /api/discounts/discount-rules/` - List discount rules
- `POST /api/discounts/discount-rules/` - Create new rule
- `GET /api/discounts/discount-rules/{id}/` - Get specific rule
- `PATCH /api/discounts/discount-rules/{id}/` - Update rule
- `DELETE /api/discounts/discount-rules/{id}/` - Delete rule

## 📊 **Database Schema**

### **DiscountType Model**
- `id`: Primary key
- `name`: Display name (e.g., "First Time Guest")
- `code`: Unique code (e.g., "FIRST_TIME")
- `description`: Detailed description
- `discount_method`: percentage, fixed_amount, or free_service
- `discount_value`: Discount amount/percentage
- `max_discount_amount`: Maximum discount limit
- `min_order_amount`: Minimum order requirement
- `is_active`: Whether discount is available
- `requires_approval`: Whether manager approval is needed
- `usage_limit_per_guest`: Max uses per guest
- `usage_limit_per_day`: Max uses per day
- `valid_from`/`valid_until`: Validity period
- `created_by`: User who created the discount type

### **ReservationDiscount Model**
- `id`: Primary key
- `reservation`: Link to reservation
- `discount_type`: Link to discount type
- `applied_by`: User who applied the discount
- `approved_by`: User who approved (if required)
- `original_amount`: Amount before discount
- `discount_amount`: Discount amount
- `final_amount`: Amount after discount
- `status`: pending, approved, applied, rejected, cancelled
- `reason`: Reason for applying discount
- `notes`: Additional notes
- `rejection_reason`: Reason for rejection
- `applied_at`/`approved_at`/`rejected_at`: Timestamps

### **DiscountRule Model**
- `id`: Primary key
- `name`: Rule name
- `description`: Rule description
- `is_active`: Whether rule is active
- `priority`: Rule priority (higher = applied first)
- `conditions`: JSON field with rule conditions
- `discount_type`: Discount type to apply
- `valid_from`/`valid_until`: Validity period
- `created_by`: User who created the rule

## 🎨 **Frontend Components**

### **ReservationBookingForm Updates**
- Added discount section with available and applied discounts
- Discount application dialog with reason and notes
- Real-time price calculation with discounts
- Approval workflow indicators

### **Key Features**
1. **Available Discounts**: Shows eligible discounts for the current reservation
2. **Discount Preview**: Calculates and displays savings before applying
3. **Applied Discounts**: Lists all applied discounts with status
4. **Approval Indicators**: Shows which discounts require approval
5. **Price Summary**: Displays original total, discount amount, and final total

## 🔐 **Permission System**

### **Role-Based Access**
- **Admin**: Full access to all discount functions
- **Manager**: Can create discount types, approve discounts
- **Front Office**: Can apply pre-approved discounts
- **Employee**: Limited discount application based on rules

### **Permission Codes**
- `discounts.view_discounttype`
- `discounts.add_discounttype`
- `discounts.change_discounttype`
- `discounts.delete_discounttype`
- `discounts.view_reservationdiscount`
- `discounts.add_reservationdiscount`
- `discounts.change_reservationdiscount`
- `discounts.delete_reservationdiscount`
- `discounts.view_discountrule`
- `discounts.add_discountrule`
- `discounts.change_discountrule`
- `discounts.delete_discountrule`
- `discounts.apply_discount`
- `discounts.approve_discount`

## 📈 **Reporting & Analytics**

### **Available Reports**
1. **Discount Usage Report**: Track which discounts are used most
2. **Employee Discount Report**: See which employees apply discounts
3. **Revenue Impact Report**: Analyze discount impact on revenue
4. **Approval Workflow Report**: Track approval times and patterns

### **Key Metrics**
- Total discount amount given
- Number of discounts applied per employee
- Average discount percentage
- Most popular discount types
- Approval vs rejection rates

## 🚀 **Next Steps**

1. **Test the system** with sample data
2. **Configure permissions** for different user roles
3. **Set up approval workflows** for restricted discounts
4. **Create reporting dashboards** for discount analytics
5. **Train staff** on the new discount system
6. **Monitor usage** and adjust discount rules as needed

## 🛠️ **Troubleshooting**

### **Common Issues**
1. **Discounts not showing**: Check if discount types are active and valid
2. **Permission errors**: Ensure user has proper permissions
3. **Calculation errors**: Verify discount values and limits
4. **Approval workflow**: Check if discount requires approval

### **Debug Commands**
```bash
# Check discount types
python manage.py shell -c "from discounts.models import DiscountType; print(DiscountType.objects.all())"

# Check applied discounts
python manage.py shell -c "from discounts.models import ReservationDiscount; print(ReservationDiscount.objects.all())"

# Test discount calculation
python manage.py shell -c "from discounts.utils import discount_calculator; print(discount_calculator.calculate_discount_amount(...))"
```

This comprehensive discount system provides full tracking, employee accountability, and flexible discount management for your health club operations.
