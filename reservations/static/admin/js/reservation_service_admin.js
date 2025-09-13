(function($) {
    'use strict';
    
    // Function to populate service details when service is selected
    function populateServiceDetails() {
        $('.reservationservice_set-group').each(function() {
            var $group = $(this);
            var $serviceSelect = $group.find('select[id$="-service"]');
            var $unitPriceInput = $group.find('input[id$="-unit_price"]');
            
            $serviceSelect.on('change', function() {
                var serviceId = $(this).val();
                if (serviceId) {
                    // Make AJAX call to get service details
                    $.ajax({
                        url: '/admin/services/service/' + serviceId + '/change/',
                        type: 'GET',
                        success: function(data) {
                            // Extract price from the response
                            var priceMatch = data.match(/name="price" value="([^"]+)"/);
                            if (priceMatch) {
                                $unitPriceInput.val(priceMatch[1]);
                            }
                        },
                        error: function() {
                            console.log('Could not fetch service details');
                        }
                    });
                } else {
                    $unitPriceInput.val('');
                }
            });
        });
    }
    
    // Function to calculate total price
    function calculateTotalPrice() {
        $('.reservationservice_set-group').each(function() {
            var $group = $(this);
            var $unitPriceInput = $group.find('input[id$="-unit_price"]');
            var $quantityInput = $group.find('input[id$="-quantity"]');
            var $totalPriceDisplay = $group.find('.total-price-display');
            
            function updateTotal() {
                var unitPrice = parseFloat($unitPriceInput.val()) || 0;
                var quantity = parseInt($quantityInput.val()) || 1;
                var total = unitPrice * quantity;
                
                if ($totalPriceDisplay.length) {
                    $totalPriceDisplay.text('$' + total.toFixed(2));
                }
            }
            
            $unitPriceInput.on('input', updateTotal);
            $quantityInput.on('input', updateTotal);
            
            // Initial calculation
            updateTotal();
        });
    }
    
    // Initialize when document is ready
    $(document).ready(function() {
        populateServiceDetails();
        calculateTotalPrice();
        
        // Re-initialize when new inline forms are added
        $(document).on('formset:added', function(event, $row) {
            populateServiceDetails();
            calculateTotalPrice();
        });
    });
    
})(django.jQuery);
