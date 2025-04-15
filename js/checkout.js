(function ($) {
    "use strict";

    // Configuration constants (aligned with main.js and cart.js)
    const CONFIG = {
        CURRENCY: '$',
        renderDelay: 100,
        shippingCost: 10
    };

    // Reuse sanitizeInput from main.js/cart.js or define locally
    const sanitizeInput = window.sanitizeInput || (input => {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    });

    // Get cart from localStorage with error handling
    const getCart = () => {
        try {
            return JSON.parse(localStorage.getItem('cart') || '[]');
        } catch (e) {
            console.error('Failed to parse cart:', e);
            localStorage.setItem('cart', '[]');
            return [];
        }
    };

    // Validate and repair cart data (aligned with main.js/cart.js)
    const validateAndRepairCart = () => {
        let cart = getCart();
        cart = cart.map((item, index) => {
            if (!item || typeof item.id === 'undefined') {
                console.warn(`Removing invalid cart item at index ${index}:`, item);
                return null;
            }
            return {
                id: item.id,
                name: item.name || `Product ${item.id}`,
                price: Number.isFinite(item.price) && item.price > 0 ? item.price : 99.99,
                image: item.image || 'img/product-1.jpg',
                quantity: Math.max(1, Math.floor(item.quantity || 1)),
                size: item.size || 'M',
                color: item.color || 'Black'
            };
        }).filter(Boolean);
        localStorage.setItem('cart', JSON.stringify(cart));
        if (cart.length === 0) localStorage.removeItem('couponDiscount');
        return cart;
    };

    // Update cart badge
    const updateCartBadge = () => {
        const cart = getCart();
        const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
        $('.fas.fa-shopping-cart').next('.badge').text(totalItems);
    };

    // Render a single order item
    const renderOrderItem = (item) => {
        const itemTotal = (item.price * item.quantity).toFixed(2);
        return `
            <div class="d-flex justify-content-between">
                <p>${sanitizeInput(item.name)} (${sanitizeInput(item.size)}, ${sanitizeInput(item.color)}, Qty: ${item.quantity})</p>
                <p>${CONFIG.CURRENCY}${itemTotal}</p>
            </div>
        `;
    };

    // Render order summary
    const renderOrderSummary = ($container, $subtotal, $shipping, $discount, $total) => {
        const cart = validateAndRepairCart();
        $container.empty().append('<h6 class="mb-3">Products</h6>');
        let subtotal = 0;

        if (!cart.length) {
            $container.append('<p>Your cart is empty. <a href="shop.html">Shop now</a>.</p>');
            $subtotal.text(`${CONFIG.CURRENCY}0.00`);
            $shipping.text(`${CONFIG.CURRENCY}0.00`);
            $discount.text(`${CONFIG.CURRENCY}0.00`);
            $total.text(`${CONFIG.CURRENCY}0.00`);
        } else {
            const fragment = document.createDocumentFragment();
            cart.forEach(item => {
                const $item = $(renderOrderItem(item));
                fragment.appendChild($item[0]);
                subtotal += item.price * item.quantity;
            });
            $container[0].appendChild(fragment);

            const shipping = cart.length > 0 ? CONFIG.shippingCost : 0;
            const couponDiscount = parseFloat(localStorage.getItem('couponDiscount')) || 0;
            const total = Math.max(0, subtotal + shipping - couponDiscount);

            $subtotal.text(`${CONFIG.CURRENCY}${subtotal.toFixed(2)}`);
            $shipping.text(`${CONFIG.CURRENCY}${shipping.toFixed(2)}`);
            $discount.text(`${CONFIG.CURRENCY}${couponDiscount.toFixed(2)}`);
            $total.text(`${CONFIG.CURRENCY}${total.toFixed(2)}`);
        }

        updateCartBadge();
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
            if (!$(`#${field.id}`).val().trim()) {
                errors.push(`${field.name} is required.`);
            }
        });

        const email = $('#billing-email').val().trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('Please enter a valid email address.');
        }

        const mobile = $('#billing-mobile').val().trim();
        if (mobile && !/^\+?\d{10,15}$/.test(mobile)) {
            errors.push('Please enter a valid mobile number (10-15 digits).');
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
                if (!$(`#${field.id}`).val().trim()) {
                    errors.push(`${field.name} is required.`);
                }
            });

            const shippingEmail = $('#shipping-email').val().trim();
            if (shippingEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shippingEmail)) {
                errors.push('Please enter a valid shipping email address.');
            }

            const shippingMobile = $('#shipping-mobile').val().trim();
            if (shippingMobile && !/^\+?\d{10,15}$/.test(shippingMobile)) {
                errors.push('Please enter a valid shipping mobile number.');
            }
        }

        if (!$('input[name="payment"]:checked').length) {
            errors.push('Please select a payment method.');
        }

        return errors;
    };

    // Get order details
    const getOrderDetails = ($subtotal, $shipping, $discount, $total) => {
        const cart = getCart();
        return {
            billing: {
                firstName: sanitizeInput($('#billing-first-name').val()),
                lastName: sanitizeInput($('#billing-last-name').val()),
                email: sanitizeInput($('#billing-email').val()),
                mobile: sanitizeInput($('#billing-mobile').val()),
                address1: sanitizeInput($('#billing-address1').val()),
                address2: sanitizeInput($('#billing-address2').val()),
                country: sanitizeInput($('#billing-country').val()),
                city: sanitizeInput($('#billing-city').val()),
                state: sanitizeInput($('#billing-state').val()),
                zip: sanitizeInput($('#billing-zip').val())
            },
            shipping: $('#shipto').is(':checked') ? {
                firstName: sanitizeInput($('#shipping-first-name').val()),
                lastName: sanitizeInput($('#shipping-last-name').val()),
                email: sanitizeInput($('#shipping-email').val()),
                mobile: sanitizeInput($('#shipping-mobile').val()),
                address1: sanitizeInput($('#shipping-address1').val()),
                address2: sanitizeInput($('#shipping-address2').val()),
                country: sanitizeInput($('#shipping-country').val()),
                city: sanitizeInput($('#shipping-city').val()),
                state: sanitizeInput($('#shipping-state').val()),
                zip: sanitizeInput($('#shipping-zip').val())
            } : null,
            items: cart,
            subtotal: parseFloat($subtotal.text().replace(CONFIG.CURRENCY, '')),
            shipping: parseFloat($shipping.text().replace(CONFIG.CURRENCY, '')),
            couponDiscount: parseFloat($discount.text().replace(CONFIG.CURRENCY, '')),
            total: parseFloat($total.text().replace(CONFIG.CURRENCY, '')),
            paymentMethod: $('input[name="payment"]:checked').val() || 'Unknown'
        };
    };

    // Initialize page
    $(document).ready(() => {
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
        $placeOrder.off('click').on('click', e => {
            e.preventDefault();

            const cart = validateAndRepairCart();
            if (!cart.length) {
                alert('Your cart is empty. Please add items to proceed.');
                window.location.href = 'shop.html';
                return;
            }

            const errors = validateForm();
            if (errors.length) {
                alert(`Please fix the following errors:\n- ${errors.join('\n- ')}`);
                return;
            }

            const orderDetails = getOrderDetails($subtotal, $shipping, $discount, $total);

            localStorage.removeItem('cart');
            localStorage.removeItem('couponDiscount');

            alert(`Order placed successfully!\n\nOrder Details:\n` +
                `Name: ${orderDetails.billing.firstName} ${orderDetails.billing.lastName}\n` +
                `Email: ${orderDetails.billing.email}\n` +
                `Total: ${CONFIG.CURRENCY}${orderDetails.total.toFixed(2)}\n` +
                `Payment: ${orderDetails.paymentMethod}\n` +
                'Thank you for shopping with us!');

            window.location.href = 'index.html';
        });
    });
})(jQuery);