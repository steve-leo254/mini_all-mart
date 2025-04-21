(function ($) {
    "use strict";

    // Configuration constants (aligned with main.js)
    const CONFIG = {
        CURRENCY: 'ksh',
        renderDelay: 100,
        defaultPrice: 99.99,
        defaultImage: 'img/product-1.jpg',
        shippingCost: 10
    };

    // Reuse sanitizeInput from main.js or define locally
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

    // Update cart badge with total items
    const updateCartBadge = () => {
        const cart = getCart();
        const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
        $('.fas.fa-shopping-cart').next('.badge').text(totalItems);
    };

    // Validate and repair cart data
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
                price: Number.isFinite(item.price) && item.price > 0 ? item.price : CONFIG.defaultPrice,
                image: item.image || CONFIG.defaultImage,
                quantity: Math.max(1, Math.floor(item.quantity || 1)),
                size: item.size || 'M',
                color: item.color || 'Black'
            };
        }).filter(Boolean);
        localStorage.setItem('cart', JSON.stringify(cart));
        if (cart.length === 0) localStorage.removeItem('couponDiscount');
        return cart;
    };

    // Generate a cart row HTML
    const renderCartRow = (item, index) => {
        const subtotal = (item.price * item.quantity).toFixed(2);
        return $(`
            <tr>
                <td class="align-middle">
                    <img src="${sanitizeInput(item.image)}" alt="${sanitizeInput(item.name)}" style="width: 50px;">
                    ${sanitizeInput(item.name)}
                </td>
                <td class="align-middle">${CONFIG.CURRENCY}${item.price.toFixed(2)}</td>
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
                <td class="align-middle">${CONFIG.CURRENCY}${subtotal}</td>
                <td class="align-middle">
                    <button class="btn btn-sm btn-danger remove-item" data-index="${index}" aria-label="Remove ${sanitizeInput(item.name)}">
                        <i class="fa fa-times"></i>
                    </button>
                </td>
            </tr>
        `);
    };

    // Render cart table
    const renderCart = () => {
        const cart = validateAndRepairCart();
        const $cartItems = $('#cart-items');
        $cartItems.empty();

        if (!cart.length) {
            $cartItems.html('<tr><td colspan="7" class="text-center">Your cart is empty. <a href="shop.html">Shop now</a>.</td></tr>');
            updateSummary();
            return;
        }

        const fragment = document.createDocumentFragment();
        cart.forEach((item, index) => {
            fragment.appendChild(renderCartRow(item, index)[0]);
        });
        $cartItems[0].appendChild(fragment);

        updateSummary();
        updateCartBadge();
    };

    // Update cart summary
    const updateSummary = () => {
        const cart = getCart();
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const couponDiscount = parseFloat(localStorage.getItem('couponDiscount')) || 0;
        const shipping = cart.length > 0 ? CONFIG.shippingCost : 0;
        const total = Math.max(0, subtotal - couponDiscount + shipping);

        $('#subtotal').text(`${CONFIG.CURRENCY}${subtotal.toFixed(2)}`);
        $('#coupon-discount').text(couponDiscount > 0 ? `-${CONFIG.CURRENCY}${couponDiscount.toFixed(2)}` : `${CONFIG.CURRENCY}0.00`);
        $('#shipping').text(`${CONFIG.CURRENCY}${shipping.toFixed(2)}`);
        $('#total').text(`${CONFIG.CURRENCY}${total.toFixed(2)}`);
    };

    // Apply coupon code
    const applyCoupon = () => {
        const code = $('#coupon-code').val().trim().toUpperCase();
        const coupons = {
            'SAVE10': 10,
            'SAVE20': 20
        };

        if (coupons[code]) {
            localStorage.setItem('couponDiscount', coupons[code]);
            alert(`Coupon applied! ${CONFIG.CURRENCY}${coupons[code]} discount.`);
        } else {
            localStorage.removeItem('couponDiscount');
            alert('Invalid coupon code.');
        }

        $('#coupon-code').val('');
        updateSummary();
    };

    // Initialize page
    $(document).ready(() => {
        if (typeof window.ethereum !== 'undefined') {
            console.log('Web3 provider detected. Ensuring no interference.');
        }

        // Cache selectors
        const $cartItems = $('#cart-items');
        const $couponCode = $('#coupon-code');
        const $applyCoupon = $('#apply-coupon');
        const $checkoutBtn = $('#checkout-btn');

        // Render cart with delay
        setTimeout(renderCart, CONFIG.renderDelay);

        // Quantity buttons
        $(document).off('click', '.quantity button').on('click', '.quantity button', function () {
            const $button = $(this);
            const $input = $button.closest('.quantity').find('input');
            const index = $button.closest('tr').find('.remove-item').data('index');
            let value = parseInt($input.val(), 10) || 1;
            const cart = getCart();

            if (!cart[index]) return;

            if ($button.hasClass('btn-plus')) {
                value = Math.min(value + 1, 100); // Cap at 100
            } else if ($button.hasClass('btn-minus') && value > 1) {
                value--;
            }

            cart[index].quantity = value;
            localStorage.setItem('cart', JSON.stringify(cart));
            renderCart();
        });

        // Remove item
        $(document).off('click', '.remove-item').on('click', '.remove-item', function () {
            if (confirm('Are you sure you want to remove this item?')) {
                const index = $(this).data('index');
                const cart = getCart();
                cart.splice(index, 1);
                localStorage.setItem('cart', JSON.stringify(cart));
                renderCart();
            }
        });

        // Apply coupon
        $applyCoupon.off('click').on('click', e => {
            e.preventDefault();
            applyCoupon();
        });

        // Checkout button
        $checkoutBtn.off('click').on('click', () => {
            const cart = getCart();
            if (!cart.length) {
                alert('Your cart is empty.');
                window.location.href = 'shop.html';
            } else {
                window.location.href = 'checkout.html';
            }
        });
    });
})(jQuery);