$(document).ready(function () {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const productsContainer = $('#order-products');
    const subtotalElement = $('#order-subtotal');
    const shippingElement = $('#order-shipping');
    const discountElement = $('#cart-discount');
    const totalElement = $('#order-total');

    function renderOrderSummary() {
        productsContainer.empty();
        productsContainer.append('<h6 class="mb-3">Products</h6>');
        let subtotal = 0;

        if (cart.length === 0) {
            productsContainer.append('<p>Your cart is empty. <a href="shop.html">Shop now</a>.</p>');
            subtotalElement.text('$0.00');
            shippingElement.text('$0.00');
            discountElement.text('$0.00');
            totalElement.text('$0.00');
        } else {
            cart.forEach(item => {
                const itemTotal = item.price * item.quantity;
                subtotal += itemTotal;
                productsContainer.append(`
                    <div class="d-flex justify-content-between">
                        <p>${item.name} (${item.size}, ${item.color}, Qty: ${item.quantity})</p>
                        <p>$${itemTotal.toFixed(2)}</p>
                    </div>
                `);
            });

            const shipping = cart.length > 0 ? 10.00 : 0.00;
            const couponDiscount = localStorage.getItem('couponDiscount') ? parseFloat(localStorage.getItem('couponDiscount')) : 0;
            const total = subtotal + shipping - couponDiscount;

            subtotalElement.text(`$${subtotal.toFixed(2)}`);
            shippingElement.text(`$${shipping.toFixed(2)}`);
            discountElement.text(`$${couponDiscount.toFixed(2)}`);
            totalElement.text(`$${total.toFixed(2)}`);
        }

        updateCartBadge();
    }

    function validateForm() {
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

        let errors = [];
        requiredFields.forEach(field => {
            const value = $(`#${field.id}`).val().trim();
            if (!value) {
                errors.push(`${field.name} is required.`);
            }
        });

        const email = $('#billing-email').val().trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (email && !emailRegex.test(email)) {
            errors.push('Please enter a valid email address.');
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
                }
            });

            const shippingEmail = $('#shipping-email').val().trim();
            if (shippingEmail && !emailRegex.test(shippingEmail)) {
                errors.push('Please enter a valid shipping email address.');
            }
        }

        if (!$('input[name="payment"]:checked').length) {
            errors.push('Please select a payment method.');
        }

        return errors;
    }

    $('#place-order').click(function (e) {
        e.preventDefault();

        if (cart.length === 0) {
            alert('Your cart is empty. Please add items to proceed.');
            window.location.href = 'shop.html';
            return;
        }

        const errors = validateForm();
        if (errors.length > 0) {
            alert('Please fix the following errors:\n- ' + errors.join('\n- '));
            return;
        }

        const orderDetails = {
            billing: {
                firstName: $('#billing-first-name').val(),
                lastName: $('#billing-last-name').val(),
                email: $('#billing-email').val(),
                mobile: $('#billing-mobile').val(),
                address1: $('#billing-address1').val(),
                address2: $('#billing-address2').val(),
                country: $('#billing-country').val(),
                city: $('#billing-city').val(),
                state: $('#billing-state').val(),
                zip: $('#billing-zip').val()
            },
            shipping: $('#shipto').is(':checked') ? {
                firstName: $('#shipping-first-name').val(),
                lastName: $('#shipping-last-name').val(),
                email: $('#shipping-email').val(),
                mobile: $('#shipping-mobile').val(),
                address1: $('#shipping-address1').val(),
                address2: $('#shipping-address2').val(),
                country: $('#shipping-country').val(),
                city: $('#shipping-city').val(),
                state: $('#shipping-state').val(),
                zip: $('#shipping-zip').val()
            } : null,
            items: cart,
            subtotal: parseFloat(subtotalElement.text().replace('$', '')),
            shipping: parseFloat(shippingElement.text().replace('$', '')),
            couponDiscount: parseFloat(discountElement.text().replace('$', '')),
            total: parseFloat(totalElement.text().replace('$', '')),
            paymentMethod: $('input[name="payment"]:checked').attr('id')
        };

        localStorage.removeItem('cart');
        localStorage.removeItem('couponDiscount');

        alert('Order placed successfully!\n\nOrder Details:\n' +
            `Name: ${orderDetails.billing.firstName} ${orderDetails.billing.lastName}\n` +
            `Email: ${orderDetails.billing.email}\n` +
            `Total: $${orderDetails.total.toFixed(2)}\n` +
            `Payment: ${orderDetails.paymentMethod}\n` +
            'Thank you for shopping with us!');

        window.location.href = 'index.html';
    });

    function updateCartBadge() {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        $('.fas.fa-shopping-cart').next('.badge').text(totalItems);
    }

    renderOrderSummary();
});