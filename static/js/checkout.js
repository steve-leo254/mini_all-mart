(function ($) {
    "use strict";

    // Configuration constants (aligned with main.js)
    const CONFIG = {
        CURRENCY: 'KSH',
        LOCALE: 'en-KE',
        renderDelay: 100,
        shippingCost: 10,
        maxAjaxRetries: 3,
        retryDelay: 1000
    };

    // Reuse utilities from main.js
    const sanitizeInput = window.sanitizeInput || (input => {
        if (typeof input !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML.replace(/[<>]/g, '');
    });

    const formatCurrency = window.formatCurrency || (amount => {
        return new Intl.NumberFormat(CONFIG.LOCALE, {
            style: 'currency',
            currency: CONFIG.CURRENCY
        }).format(amount);
    });

    // Get CSRF token
    const getCsrfToken = () => {
        return $('meta[name="csrf-token"]').attr('content') || $('input[name="csrf_token"]').val() || '';
    };

    // Fetch cart from server
    const fetchCart = async () => {
        let attempt = 1;
        while (attempt <= CONFIG.maxAjaxRetries) {
            try {
                const response = await $.get('/cart', { _t: Date.now() }, null, 'json');
                return response.cart || [];
            } catch (e) {
                console.error(`Attempt ${attempt} to fetch cart failed:`, e);
                if (attempt === CONFIG.maxAjaxRetries) {
                    showError('Unable to load cart. Please try again.');
                    return [];
                }
                attempt++;
                await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
            }
        }
    };

    // Update cart badge
    const updateCartBadge = async () => {
        try {
            const cart = await fetchCart();
            const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
            $('.fas.fa-shopping-cart + .badge').text(totalItems).attr('aria-label', `Cart contains ${totalItems} items`);
        } catch (e) {
            console.error('Failed to update cart badge:', e);
            showError('Unable to update cart badge.');
        }
    };

    // Show error or success message
    const showError = (message, isSuccess = false) => {
        const $errorContainer = $('#error-container');
        if (!$errorContainer.length) {
            $('body').prepend(`<div id="error-container" class="alert ${isSuccess ? 'alert-success' : 'alert-danger'} alert-dismissible fade show" role="alert" aria-live="assertive"></div>`);
        }
        $errorContainer.html(`
            ${message}
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                <span aria-hidden="true">×</span>
            </button>
        `).show();
    };

    // Render a single order item
    const renderOrderItem = (item) => {
        const itemTotal = (item.price * item.quantity).toFixed(2);
        return `
            <div class="d-flex justify-content-between">
                <p>${sanitizeInput(item.name)} (${sanitizeInput(item.size)}, ${sanitizeInput(item.color)}, Qty: ${item.quantity})</p>
                <p>${formatCurrency(itemTotal)}</p>
            </div>
        `;
    };

    // Render order summary
    const renderOrderSummary = async ($container, $subtotal, $shipping, $discount, $total) => {
        const cart = await fetchCart();
        $container.empty().append('<h6 class="mb-3">Products</h6>').attr('aria-live', 'polite');
        let subtotal = 0;

        if (!cart.length) {
            $container.append('<p>Your cart is empty. <a href="shop.html">Shop now</a>.</p>');
            $subtotal.text(formatCurrency(0));
            $shipping.text(formatCurrency(0));
            $discount.text(formatCurrency(0));
            $total.text(formatCurrency(0));
        } else {
            const fragment = document.createDocumentFragment();
            cart.forEach(item => {
                const $item = $(renderOrderItem(item));
                fragment.appendChild($item[0]);
                subtotal += item.price * item.quantity;
            });
            $container[0].appendChild(fragment);

            const shipping = cart.length > 0 ? CONFIG.shippingCost : 0;
            const couponDiscount = parseFloat(localStorage.getItem('couponDiscount')) || 0; // Fallback
            const total = Math.max(0, subtotal + shipping - couponDiscount);

            $subtotal.text(formatCurrency(subtotal));
            $shipping.text(formatCurrency(shipping));
            $discount.text(formatCurrency(couponDiscount));
            $total.text(formatCurrency(total));
        }

        await updateCartBadge();
    };

    // Validate checkout form
    const validateForm = () => {
        const requiredFields = [
            { id: 'billing-first-name', name: 'First Name' },
            { id: 'billing-last-name', name: 'Last Name' },
            { id: 'billing-email', name: 'Email' },
            { id: 'billing-address1', name: 'Address Line 1' },
            { id: 'billing-country', name: 'Country' },
            { id: 'billing-city', name: 'City' },
            { id: 'billing-state', name: 'State' },
            { id: 'billing-zip', name: 'ZIP Code' }
        ];

        const errors = [];
        requiredFields.forEach(field => {
            const value = $(`#${field.id}`).val().trim();
            if (!value) {
                errors.push(`${field.name} is required.`);
                $(`#${field.id}`).addClass('is-invalid').attr('aria-invalid', 'true');
            } else {
                $(`#${field.id}`).removeClass('is-invalid').attr('aria-invalid', 'false');
            }
        });

        const email = $('#billing-email').val().trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('Please enter a valid email address.');
            $('#billing-email').addClass('is-invalid').attr('aria-invalid', 'true');
        } else {
            $('#billing-email').removeClass('is-invalid').attr('aria-invalid', 'false');
        }

        const mobile = $('#billing-mobile').val().trim();
        if (mobile && !/^\+?\d{10,15}$/.test(mobile)) {
            errors.push('Please enter a valid mobile number (10-15 digits).');
            $('#billing-mobile').addClass('is-invalid').attr('aria-invalid', 'true');
        } else {
            $('#billing-mobile').removeClass('is-invalid').attr('aria-invalid', 'false');
        }

        if ($('#shipto').is(':checked')) {
            const shippingFields = [
                { id: 'shipping-first-name', name: 'Shipping First Name' },
                { id: 'shipping-last-name', name: 'Shipping Last Name' },
                { id: 'shipping-address1', name: 'Shipping Address Line 1' },
                { id: 'shipping-country', name: 'Shipping Country' },
                { id: 'shipping-city', name: 'Shipping City' },
                { id: 'shipping-state', name: 'Shipping State' },
                { id: 'shipping-zip', name: 'Shipping ZIP Code' }
            ];

            shippingFields.forEach(field => {
                const value = $(`#${field.id}`).val().trim();
                if (!value) {
                    errors.push(`${field.name} is required.`);
                    $(`#${field.id}`).addClass('is-invalid').attr('aria-invalid', 'true');
                } else {
                    $(`#${field.id}`).removeClass('is-invalid').attr('aria-invalid', 'false');
                }
            });

            const shippingEmail = $('#shipping-email').val().trim();
            if (shippingEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shippingEmail)) {
                errors.push('Please enter a valid shipping email address.');
                $('#shipping-email').addClass('is-invalid').attr('aria-invalid', 'true');
            } else {
                $('#shipping-email').removeClass('is-invalid').attr('aria-invalid', 'false');
            }

            const shippingMobile = $('#shipping-mobile').val().trim();
            if (shippingMobile && !/^\+?\d{10,15}$/.test(shippingMobile)) {
                errors.push('Please enter a valid shipping mobile number.');
                $('#shipping-mobile').addClass('is-invalid').attr('aria-invalid', 'true');
            } else {
                $('#shipping-mobile').removeClass('is-invalid').attr('aria-invalid', 'false');
            }
        }

        if (!$('input[name="payment"]:checked').length) {
            errors.push('Please select a payment method.');
            $('input[name="payment"]').closest('.form-group').addClass('is-invalid').attr('aria-invalid', 'true');
        } else {
            $('input[name="payment"]').closest('.form-group').removeClass('is-invalid').attr('aria-invalid', 'false');
        }

        if (errors.length) {
            const $errorContainer = $('#form-errors');
            if (!$errorContainer.length) {
                $('#checkout-form').prepend('<div id="form-errors" class="alert alert-danger" role="alert" aria-live="assertive"></div>');
            }
            $errorContainer.html(`<ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul>`);
        } else {
            $('#form-errors').remove();
        }

        return errors;
    };

    // Initialize page
    $(document).ready(async () => {
        // Cache selectors
        const $productsContainer = $('#order-products');
        const $subtotal = $('#order-subtotal');
        const $shipping = $('#order-shipping');
        const $discount = $('#cart-discount');
        const $total = $('#order-total');
        const $placeOrder = $('#place-order');

        // Render order summary
        setTimeout(() => renderOrderSummary($productsContainer, $subtotal, $shipping, $discount, $total), CONFIG.renderDelay);

        // Place order
        $placeOrder.off('click').on('click', async e => {
            e.preventDefault();

            const cart = await fetchCart();
            if (!cart.length) {
                showError('Your cart is empty. Please add items to proceed.');
                window.location.href = 'shop.html';
                return;
            }

            const errors = validateForm();
            if (errors.length) {
                return;
            }

            const orderDetails = {
                'billing-first-name': sanitizeInput($('#billing-first-name').val()),
                'billing-last-name': sanitizeInput($('#billing-last-name').val()),
                'billing-email': sanitizeInput($('#billing-email').val()),
                'billing-mobile': sanitizeInput($('#billing-mobile').val()),
                'billing-address1': sanitizeInput($('#billing-address1').val()),
                'billing-address2': sanitizeInput($('#billing-address2').val()),
                'billing-country': sanitizeInput($('#billing-country').val()),
                'billing-city': sanitizeInput($('#billing-city').val()),
                'billing-state': sanitizeInput($('#billing-state').val()),
                'billing-zip': sanitizeInput($('#billing-zip').val()),
                shipping: $('#shipto').is(':checked') ? {
                    'shipping-first-name': sanitizeInput($('#shipping-first-name').val()),
                    'shipping-last-name': sanitizeInput($('#shipping-last-name').val()),
                    'shipping-email': sanitizeInput($('#shipping-email').val()),
                    'shipping-mobile': sanitizeInput($('#shipping-mobile').val()),
                    'shipping-address1': sanitizeInput($('#shipping-address1').val()),
                    'shipping-address2': sanitizeInput($('#shipping-address2').val()),
                    'shipping-country': sanitizeInput($('#shipping-country').val()),
                    'shipping-city': sanitizeInput($('#shipping-city').val()),
                    'shipping-state': sanitizeInput($('#shipping-state').val()),
                    'shipping-zip': sanitizeInput($('#shipping-zip').val())
                } : null,
                items: cart,
                subtotal: parseFloat($subtotal.text().replace(/[^\d.]/g, '')),
                shipping: parseFloat($shipping.text().replace(/[^\d.]/g, '')),
                'coupon-discount': parseFloat($discount.text().replace(/[^\d.]/g, '')),
                total: parseFloat($total.text().replace(/[^\d.]/g, '')),
                payment: $('input[name="payment"]:checked').val(),
                csrf_token: getCsrfToken()
            };

            let attempt = 1;
            while (attempt <= CONFIG.maxAjaxRetries) {
                try {
                    const response = await $.post({
                        url: '/checkout',
                        data: JSON.stringify(orderDetails),
                        contentType: 'application/json',
                        dataType: 'json'
                    });
                    showError(`Order placed successfully! Order ID: ${response.sale_id}`, true);
                    window.location.href = 'index.html';
                    return;
                } catch (e) {
                    console.error(`Attempt ${attempt} to place order failed:`, e);
                    if (attempt === CONFIG.maxAjaxRetries) {
                        showError('Failed to place order. Please try again.');
                        return;
                    }
                    attempt++;
                    await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
                }
            }
        });
    });
})(jQuery);