# Discount System Design & Implementation

## 🎯 **System Overview**

A comprehensive discount system that allows:
- **Multiple discount types**: Percentage, fixed amount, membership-based, employee-based
- **Employee authorization**: Track which employee applied discounts
- **Reservation-level tracking**: Link discounts to specific reservations
- **Audit trail**: Complete history of discount applications
- **Permission-based access**: Control who can apply discounts

## 🏗️ **Architecture Design**

### **1. Core Models**

#### **DiscountType Model**
```python
class DiscountType(models.Model):
    name = models.CharField(max_length=100)  # "First Time Guest", "Employee Discount"
    code = models.CharField(max_length=20, unique=True)  # "FIRST_TIME", "EMP_10"
    description = models.TextField(blank=True)
    discount_method = models.CharField(max_length=20, choices=[
        ('percentage', 'Percentage'),
        ('fixed_amount', 'Fixed Amount'),
        ('free_service', 'Free Service'),
    ])
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    max_discount_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    min_order_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    requires_approval = models.BooleanField(default=False)
    applicable_services = models.ManyToManyField('services.Service', blank=True)
    applicable_membership_tiers = models.ManyToManyField('config.MembershipTier', blank=True)
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

#### **ReservationDiscount Model**
```python
class ReservationDiscount(models.Model):
    reservation = models.ForeignKey('reservations.Reservation', on_delete=models.CASCADE, related_name='discounts')
    discount_type = models.ForeignKey('DiscountType', on_delete=models.PROTECT)
    applied_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='applied_discounts')
    approved_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_discounts')
    
    # Discount calculation
    original_amount = models.DecimalField(max_digits=10, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2)
    final_amount = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Status and tracking
    status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('applied', 'Applied'),
        ('rejected', 'Rejected'),
    ], default='applied')
    
    reason = models.TextField(blank=True, help_text="Reason for applying this discount")
    notes = models.TextField(blank=True, help_text="Additional notes")
    
    # Timestamps
    applied_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        unique_together = ('reservation', 'discount_type')
```

#### **DiscountRule Model** (Advanced Rules Engine)
```python
class DiscountRule(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    
    # Rule conditions (JSON field for flexibility)
    conditions = models.JSONField(default=dict, help_text="Rule conditions in JSON format")
    
    # Rule actions
    discount_type = models.ForeignKey('DiscountType', on_delete=models.CASCADE)
    priority = models.IntegerField(default=0, help_text="Higher priority rules are applied first")
    
    # Validity
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_until = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### **2. Permission System Integration**

#### **Discount Permissions**
- `discounts.view_discounttype` - View discount types
- `discounts.add_discounttype` - Create discount types
- `discounts.change_discounttype` - Modify discount types
- `discounts.delete_discounttype` - Delete discount types
- `discounts.apply_discount` - Apply discounts to reservations
- `discounts.approve_discount` - Approve pending discounts
- `discounts.view_reservationdiscount` - View applied discounts
- `discounts.change_reservationdiscount` - Modify applied discounts

#### **Role-Based Access**
- **Admin**: Full access to all discount functions
- **Manager**: Can create discount types, approve discounts
- **Front Office**: Can apply pre-approved discounts
- **Employee**: Limited discount application based on rules

### **3. Business Logic**

#### **Discount Calculation Engine**
```python
class DiscountCalculator:
    def calculate_discount(self, reservation, discount_type, applied_by=None):
        # Validate discount eligibility
        if not self.is_eligible(reservation, discount_type):
            raise ValidationError("Discount not eligible for this reservation")
        
        # Calculate discount amount
        original_amount = self.get_reservation_total(reservation)
        discount_amount = self.compute_discount_amount(original_amount, discount_type)
        
        # Apply maximum discount limit
        if discount_type.max_discount_amount:
            discount_amount = min(discount_amount, discount_type.max_discount_amount)
        
        # Create discount record
        return ReservationDiscount.objects.create(
            reservation=reservation,
            discount_type=discount_type,
            applied_by=applied_by,
            original_amount=original_amount,
            discount_amount=discount_amount,
            final_amount=original_amount - discount_amount,
            status='applied' if not discount_type.requires_approval else 'pending'
        )
```

### **4. Frontend Integration**

#### **Reservation Form Updates**
- Add discount section to ReservationBookingForm
- Show available discounts based on guest/employee/service
- Display discount preview before applying
- Show approval workflow for restricted discounts

#### **Discount Management Interface**
- Discount type management
- Applied discounts history
- Approval workflow interface
- Reporting and analytics

## 📊 **Database Schema**

### **Migration Strategy**
1. Create discount models
2. Add discount fields to existing models
3. Create indexes for performance
4. Add constraints for data integrity

### **Key Relationships**
- Reservation → ReservationDiscount (One-to-Many)
- DiscountType → ReservationDiscount (One-to-Many)
- User → ReservationDiscount (One-to-Many, applied_by)
- User → ReservationDiscount (One-to-Many, approved_by)

## 🔄 **Implementation Phases**

### **Phase 1: Core Models & Backend**
1. Create discount models
2. Implement discount calculation logic
3. Add API endpoints
4. Create serializers and views

### **Phase 2: Frontend Integration**
1. Update reservation form
2. Create discount management UI
3. Implement approval workflow
4. Add permission controls

### **Phase 3: Advanced Features**
1. Rule engine implementation
2. Reporting and analytics
3. Bulk discount operations
4. Integration with POS system

## 🎯 **Benefits**

1. **Complete Audit Trail**: Track who applied what discount when
2. **Employee Accountability**: Link discounts to specific employees
3. **Flexible Rules**: Support various discount types and conditions
4. **Approval Workflow**: Control discount application with approval process
5. **Performance Tracking**: Monitor discount usage and effectiveness
6. **Integration Ready**: Works with existing reservation and POS systems
