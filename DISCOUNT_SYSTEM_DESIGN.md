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

### **Phase 1: Core Models & Backend** ✅ **COMPLETED**
1. ✅ Create discount models (`DiscountType`, `ReservationDiscount`, `DiscountRule`)
2. ✅ Implement discount calculation logic
3. ✅ Add API endpoints (`/discounts/discount-types/`, `/discounts/reservation-discounts/`)
4. ✅ Create serializers and views
5. ✅ Add permission controls and audit trails
6. ✅ Integration with reservation system

### **Phase 2: Frontend Integration** 🚧 **IN PROGRESS**
Based on current implementation, Phase 2 includes:

#### **2.1 Reservation Form Integration** ✅ **COMPLETED**
- ✅ Discount selection dropdown in `ReservationBookingForm.tsx`
- ✅ Discount application dialog with reason/notes
- ✅ Applied discounts display with amounts
- ✅ Discount calculation and validation
- ✅ Integration with existing reservation workflow

#### **2.2 Calendar Integration** ✅ **COMPLETED**
- ✅ Discount display in `StaffSchedulingCalendar.tsx` sidebar
- ✅ Applied discounts section showing details
- ✅ Payment summary with discount amounts
- ✅ Balance calculation including discounts

#### **2.3 Discount Management UI** 🚧 **TO IMPLEMENT**
1. **Discount Type Management Interface**
   - Create/edit/delete discount types
   - Configure discount rules and limits
   - Set approval requirements
   - Manage validity periods

2. **Applied Discounts Management**
   - View all applied discounts
   - Filter by status, date, employee
   - Approve/reject pending discounts
   - Cancel applied discounts

3. **Approval Workflow Interface**
   - Pending discounts queue
   - Approval/rejection with reasons
   - Notification system
   - Audit trail display

#### **2.4 Enhanced Features** 🚧 **TO IMPLEMENT**
1. **Advanced Discount Selection**
   - Smart discount suggestions based on guest history
   - Membership tier-based filtering
   - Service-specific discount eligibility
   - Real-time discount validation

2. **Reporting & Analytics**
   - Discount usage statistics
   - Employee discount performance
   - Revenue impact analysis
   - Guest discount history

3. **Permission-Based Access**
   - Role-based discount limits
   - Manager approval workflows
   - Employee discount tracking
   - Audit trail management

### **Phase 3: Advanced Features** 📋 **PLANNED**
1. Rule engine implementation
2. Bulk discount operations
3. Integration with POS system
4. Advanced reporting and analytics
5. Mobile app integration

## 🛠️ **Phase 2 Implementation Plan**

### **Current Status Assessment**
Based on the existing codebase analysis:

#### **✅ Already Implemented:**
- **Backend Models**: Complete discount system with `DiscountType`, `ReservationDiscount`, `DiscountRule`
- **API Endpoints**: Full CRUD operations for discount types and reservation discounts
- **Reservation Integration**: Discount application in `ReservationBookingForm.tsx`
- **Calendar Display**: Discount information in `StaffSchedulingCalendar.tsx`
- **Service Layer**: Complete `discountService` with all necessary methods

#### **🚧 To Implement in Phase 2:**

### **2.1 Discount Management Dashboard**
Create a comprehensive discount management interface:

**File: `healthclub-frontend/src/components/discounts/DiscountManagement.tsx`**
```typescript
// Main dashboard component with tabs for:
// - Discount Types Management
// - Applied Discounts View
// - Approval Workflow
// - Analytics & Reports
```

**File: `healthclub-frontend/src/components/discounts/DiscountTypeManager.tsx`**
```typescript
// CRUD operations for discount types
// - Create/edit/delete discount types
// - Configure rules and limits
// - Set approval requirements
// - Manage validity periods
```

**File: `healthclub-frontend/src/components/discounts/AppliedDiscountsManager.tsx`**
```typescript
// View and manage applied discounts
// - Filter by status, date, employee
// - Approve/reject pending discounts
// - Cancel applied discounts
// - View discount history
```

### **2.2 Approval Workflow Interface**
Build the approval system for restricted discounts:

**File: `healthclub-frontend/src/components/discounts/ApprovalWorkflow.tsx`**
```typescript
// Manager interface for approving discounts
// - Pending discounts queue
// - Approval/rejection with reasons
// - Bulk approval operations
// - Notification system
```

**File: `healthclub-frontend/src/components/discounts/DiscountApprovalCard.tsx`**
```typescript
// Individual discount approval card
// - Show discount details
// - Display guest/reservation info
// - Approve/reject buttons
// - Reason input fields
```

### **2.3 Enhanced Discount Selection**
Improve the discount application experience:

**File: `healthclub-frontend/src/components/discounts/SmartDiscountSelector.tsx`**
```typescript
// Enhanced discount selection with:
// - Smart suggestions based on guest history
// - Membership tier filtering
// - Service-specific eligibility
// - Real-time validation
```

**File: `healthclub-frontend/src/components/discounts/DiscountEligibilityChecker.tsx`**
```typescript
// Real-time discount eligibility validation
// - Check guest eligibility
// - Validate order requirements
// - Show usage limits
// - Display discount preview
```

### **2.4 Reporting & Analytics**
Create comprehensive reporting system:

**File: `healthclub-frontend/src/components/discounts/DiscountAnalytics.tsx`**
```typescript
// Analytics dashboard with:
// - Discount usage statistics
// - Employee performance metrics
// - Revenue impact analysis
// - Guest discount history
```

**File: `healthclub-frontend/src/components/discounts/DiscountReports.tsx`**
```typescript
// Report generation and export
// - Usage reports by date range
// - Employee discount reports
// - Revenue impact reports
// - Export to CSV/PDF
```

### **2.5 Permission-Based Access Control**
Implement role-based access:

**File: `healthclub-frontend/src/hooks/useDiscountPermissions.ts`**
```typescript
// Custom hook for discount permissions
// - Check user permissions
// - Role-based access control
// - Feature flag management
```

**File: `healthclub-frontend/src/components/discounts/PermissionGate.tsx`**
```typescript
// Permission-based component rendering
// - Show/hide features based on permissions
// - Role-based UI elements
// - Access control messages
```

### **2.6 Navigation Integration**
Add discount management to main navigation:

**File: `healthclub-frontend/src/components/layout/Navigation.tsx`**
```typescript
// Add discount management menu items:
// - Discount Management (main dashboard)
// - Pending Approvals (if user has permission)
// - Discount Reports (if user has permission)
```

### **2.7 Notification System**
Implement discount-related notifications:

**File: `healthclub-frontend/src/components/notifications/DiscountNotifications.tsx`**
```typescript
// Notification system for:
// - Pending discount approvals
// - Discount application confirmations
// - Approval/rejection notifications
// - Usage limit warnings
```

## 📋 **Implementation Checklist**

### **Week 1: Core Management Interface**
- [ ] Create `DiscountManagement.tsx` main dashboard
- [ ] Implement `DiscountTypeManager.tsx` for CRUD operations
- [ ] Add navigation menu items
- [ ] Set up routing for discount pages

### **Week 2: Approval Workflow**
- [ ] Build `ApprovalWorkflow.tsx` interface
- [ ] Create `DiscountApprovalCard.tsx` component
- [ ] Implement approval/rejection logic
- [ ] Add notification system

### **Week 3: Enhanced Features**
- [ ] Develop `SmartDiscountSelector.tsx`
- [ ] Create `DiscountEligibilityChecker.tsx`
- [ ] Implement permission-based access control
- [ ] Add real-time validation

### **Week 4: Analytics & Reporting**
- [ ] Build `DiscountAnalytics.tsx` dashboard
- [ ] Create `DiscountReports.tsx` component
- [ ] Implement data export functionality
- [ ] Add performance metrics

### **Week 5: Testing & Polish**
- [ ] Comprehensive testing
- [ ] UI/UX improvements
- [ ] Performance optimization
- [ ] Documentation updates

## 🎯 **Success Metrics**

1. **User Adoption**: 90% of staff using discount system within 2 weeks
2. **Approval Efficiency**: 50% reduction in approval time
3. **Error Reduction**: 80% fewer discount application errors
4. **Audit Compliance**: 100% of discounts tracked and auditable
5. **User Satisfaction**: 4.5+ rating from staff feedback

## 🎯 **Benefits**

1. **Complete Audit Trail**: Track who applied what discount when
2. **Employee Accountability**: Link discounts to specific employees
3. **Flexible Rules**: Support various discount types and conditions
4. **Approval Workflow**: Control discount application with approval process
5. **Performance Tracking**: Monitor discount usage and effectiveness
6. **Integration Ready**: Works with existing reservation and POS systems
