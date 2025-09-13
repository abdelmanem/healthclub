(function($) {
    'use strict';
    
    // Function to update service details when service is selected
    function updateServiceDetails(selectElement) {
        var $select = $(selectElement);
        var serviceId = $select.val();
        var $row = $select.closest('tr');
        var $unitPriceInput = $row.find('input[id$="-unit_price"]');
        
        if (serviceId) {
            // Make AJAX call to get service details
            $.ajax({
                url: '/admin/reservations/reservation/get-service-details/' + serviceId + '/',
                type: 'GET',
                success: function(data) {
                    // Update unit price
                    $unitPriceInput.val(data.price);
                    
                    // Update service details display
                    var $serviceDetails = $row.find('.service-details');
                    if ($serviceDetails.length) {
                        $serviceDetails.html(
                            '<strong>' + data.name + '</strong><br>' +
                            '<small>Duration: ' + data.duration_minutes + ' min | Price: $' + data.price + '</small>'
                        );
                    }
                    
                    // Calculate total
                    calculateTotal($unitPriceInput[0]);
                },
                error: function() {
                    console.log('Could not fetch service details for service ID: ' + serviceId);
                }
            });
        } else {
            $unitPriceInput.val('');
            var $serviceDetails = $row.find('.service-details');
            if ($serviceDetails.length) {
                $serviceDetails.html('-');
            }
        }
    }
    
    // Function to calculate total price
    function calculateTotal(inputElement) {
        var $input = $(inputElement);
        var $row = $input.closest('tr');
        var $unitPriceInput = $row.find('input[id$="-unit_price"]');
        var $quantityInput = $row.find('input[id$="-quantity"]');
        
        var unitPrice = parseFloat($unitPriceInput.val()) || 0;
        var quantity = parseInt($quantityInput.val()) || 1;
        var total = unitPrice * quantity;
        
        // Update the total price display
        var $totalDisplay = $row.find('.total-price-display');
        if ($totalDisplay.length) {
            $totalDisplay.html('<strong>$' + total.toFixed(2) + '</strong>');
        }
    }
    
    // Initialize when document is ready
    $(document).ready(function() {
        // Bind change events to existing elements
        $('.service-select').on('change', function() {
            updateServiceDetails(this);
        });
        
        $('.unit-price-input, .quantity-input').on('input change', function() {
            calculateTotal(this);
        });
        
        // Re-initialize when new inline forms are added
        $(document).on('formset:added', function(event, $row) {
            $row.find('.service-select').on('change', function() {
                updateServiceDetails(this);
            });
            
            $row.find('.unit-price-input, .quantity-input').on('input change', function() {
                calculateTotal(this);
            });
        });
    });
    
})(django.jQuery);