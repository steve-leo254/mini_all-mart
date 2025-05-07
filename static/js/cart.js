(function ($) {
    "use strict";

    // Configuration constants (aligned with main.js)
    const CONFIG = {
        CURRENCY: 'KSH',
        LOCALE: 'en-KE',
        renderDelay: 100,
        defaultPrice: 99.99,
        defaultImage: 'img/product-1.jpg',
        shippingCost: 10,
        maxAjaxRetries: 3,
        retryDelay: 1000,
        maxQuantity: 100
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

    // Generate a cart row HTML
    const renderCartRow = (item, index) => {
        const subtotal = (item.price * item.quantity).toFixed(2);
        return $(`
            <tr data-index="${index}">
                <td class="align-middle">
                    <img src="${sanitizeInput(item.image)}" alt="${sanitizeInput(item.name)}" style="width: 50px;" loading="lazy" onerror="this.src='${CONFIG.defaultImage}'">
                    ${sanitizeInput(item.name)}
                </td>
                <td class="align-middle">${formatCurrency(item.price)}</td>
                <td class="align-middle">${sanitizeInput(item.size)}</td>
                <td class="align-middle">${sanitizeInput(item.color)}</td>
                <td class="align-middle">
                    <div class="input-group quantity mx-auto" style="width: 100px;">
                        <div class="input-group-btn">
                            <button class="btn btn-sm btn-primary btn-minus" aria-label="Decrease quantity of ${sanitizeInput(item.name)}">
                                <i class="fa fa-minus"></i>
                            </button>
                        </div>
                        <input type="text" class="form-control form-control-sm bg-secondary border-0 text-center" value="${item.quantity}" readonly aria-label="Quantity of ${sanitizeInput(item.name)}">
                        <div class="input-group-btn">
                            <button class="btn btn-sm btn-primary btn-plus" aria-label="Increase quantity of ${sanitizeInput(item.name)}">
                                <i class="fa fa-plus"></i>
                            </button>
                        </div>
                    </div>
                </td>
                <td class="align-middle">${formatCurrency(subtotal)}</td>
                <td class="align-middle">
                    <button class="btn btn-sm btn-danger remove-item" data-index="${index}" aria-label="Remove ${sanitizeInput(item.name)}">
                        <i class="fa fa-times"></i>
                    </button>
                </td>
            </tr>
        `);
    };

    // Render cart table
    const renderCart = async () => {
        const cart = await fetchCart();
        const $cartItems = $('#cart-items');
        $cartItems.empty().attr('aria-live', 'polite');

        if (!cart.length) {
            $cartItems.html('<tr><td colspan="7" class="text-center">Your cart is empty. <a href="shop.html">Shop now</a>.</td></tr>');
            await updateSummary();
            return;
        }

        const fragment = document.createDocumentFragment();
        cart.forEach((item, index) => {
            fragment.appendChild(renderCartRow(item, index)[0]);
        });
        $cartItems[0].appendChild(fragment);

        await updateSummary();
        await updateCartBadge();
    };

    // Update cart summary
    const updateSummary = async () => {
        const cart = await fetchCart();
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const couponDiscount = parseFloat(localStorage.getItem('couponDiscount')) || 0; // Fallback until server-side
        const shipping = cart.length > 0 ? CONFIG.shippingCost : 0;
        const total = Math.max(0, subtotal - couponDiscount + shipping);

        $('#subtotal').text(formatCurrency(subtotal));
        $('#coupon-discount').text(couponDiscount > 0 ? `-${formatCurrency(couponDiscount)}` : formatCurrency(0));
        $('#shipping').text(formatCurrency(shipping));
        $('#total').text(formatCurrency(total));
    };

    // Apply coupon code
    const applyCoupon = async () => {
        const code = $('#coupon-code').val().trim();
        let attempt = 1;
        while (attempt <= CONFIG.maxAjaxRetries) {
            try {
                const response = await $.post({
                    url: '/coupon',
                    data: JSON.stringify({ code, csrf_token: getCsrfToken() }),
                    contentType: 'application/json',
                    dataType: 'json'
                });
                localStorage.setItem('couponDiscount', response.discount || 0); // Fallback
                showError(response.message, true);
                $('#coupon-code').val('');
                await updateSummary();
                return;
            } catch (e) {
                console.error(`Attempt ${attempt} to apply coupon failed:`, e);
                if (attempt === CONFIG.maxAjaxRetries) {
                    localStorage.removeItem('couponDiscount');
                    showError('Invalid coupon code or server error.');
                    $('#coupon-code').val('');
                    await updateSummary();
                    return;
                }
                attempt++;
                await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
            }
        }
    };

    // Update cart item quantity
    const updateCartItem = async (index, quantity, size, color, productId) => {
        let attempt = 1;
        while (attempt <= CONFIG.maxAjaxRetries) {
            try {
                const response = await $.post({
                    url: '/cart',
                    data: JSON.stringify({
                        action: 'update',
                        product_id: productId,
                        quantity,
                        size,
                        color,
                        csrf_token: getCsrfToken()
                    }),
                    contentType: 'application/json',
                    dataType: 'json'
                });
                await renderCart();
                showError(response.message, true);
                return;
            } catch (e) {
                console.error(`Attempt ${attempt} to update cart item failed:`, e);
                if (attempt === CONFIG.maxAjaxRetries) {
                    showError('Failed to update cart. Please try again.');
                    return;
                }
                attempt++;
                await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
            }
        }
    };

    // Remove cart item
    const removeCartItem = async (index, productId, size, color) => {
        let attempt = 1;
        while (attempt <= CONFIG.maxAjaxRetries) {
            try {
                const response = await $.post({
                    url: '/cart',
                    data: JSON.stringify({
                        action: 'remove',
                        product_id: productId,
                        size,
                        color,
                        csrf_token: getCsrfToken()
                    }),
                    contentType: 'application/json',
                    dataType: 'json'
                });
                await renderCart();
                showError(response.message, true);
                return;
            } catch (e) {
                console.error(`Attempt ${attempt} to remove cart item failed:`, e);
                if (attempt === CONFIG.maxAjaxRetries) {
                    showError('Failed to remove item. Please try again.');
                    return;
                }
                attempt++;
                await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
            }
        }
    };

    // Initialize page
    $(document).ready(async () => {
        if (typeof window.ethereum !== 'undefined') {
            console.log('Web3 provider detected. No interference.');
        }

        // Cache selectors
        const $cartItems = $('#cart-items');
        const $couponCode = $('#coupon-code');
        const $applyCoupon = $('#apply-coupon');
        const $checkoutBtn = $('#checkout-btn');

        // Render cart
        setTimeout(renderCart, CONFIG.renderDelay);

        // Quantity buttons
        $(document).off('click', '.quantity button').on('click', '.quantity button', async function () {
            const $button = $(this);
            const $input = $button.closest('.quantity').find('input');
            const index = $button.closest('tr').data('index');
            const cart = await fetchCart();
            const item = cart[index];

            if (!item) return;

            let value = parseInt($input.val(), 10) || 1;
            if ($button.hasClass('btn-plus')) {
                value = Math.min(value + 1, CONFIG.maxQuantity);
            } else if ($button.hasClass('btn-minus') && value > 1) {
                value--;
            }

            await updateCartItem(index, value, item.size, item.color, item.product_id);
        });

        // Remove item
        $(document).off('click', '.remove-item').on('click', async function () {
            if (confirm('Are you sure you want to remove this item?')) {
                const index = $(this).data('index');
                const cart = await fetchCart();
                const item = cart[index];
                if (item) {
                    await removeCartItem(index, item.product_id, item.size, item.color);
                }
            }
        });

        // Apply coupon
        $applyCoupon.off('click').on('click', async e => {
            e.preventDefault();
            await applyCoupon();
        });

        // Checkout button
        $checkoutBtn.off('click').on('click', async () => {
            const cart = await fetchCart();
            if (!cart.length) {
                showError('Your cart is empty.');
                window.location.href = 'shop.html';
            } else {
                window.location.href = 'checkout.html';
            }
        });
    });
})(jQuery);