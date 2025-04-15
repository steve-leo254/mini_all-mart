(function ($) {
    "use strict";

    // Reuse sanitizeInput from main.js if available, else define
    const sanitizeInput = window.sanitizeInput || function(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    };

    function updateCartBadge() {
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
        $('.fas.fa-shopping-cart').next('.badge').text(totalItems);
    }

    function validateAndRepairCart() {
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        cart = cart.map((item, index) => {
            if (!item || typeof item.id === 'undefined') {
                console.warn(`Removing invalid cart item at index ${index}:`, item);
                return null;
            }
            return {
                id: item.id,
                name: item.name || `Product ${item.id}`,
                price: typeof item.price === 'number' && item.price > 0 ? item.price : 99.99,
                image: item.image || 'img/product-1.jpg', // Fallback to existing image
                quantity: Math.max(1, Math.floor(item.quantity || 1)),
                size: item.size || 'M',
                color: item.color || 'Black'
            };
        }).filter(item => item !== null);
        localStorage.setItem('cart', JSON.stringify(cart));
        if (cart.length === 0) {
            localStorage.removeItem('couponDiscount');
        }
        return cart;
    }

    function renderCart() {
        const cart = validateAndRepairCart();
        const $cartItems = $('#cart-items');
        $cartItems.empty();

        if (cart.length === 0) {
            $cartItems.html('<tr><td colspan="7" class="text-center">Your cart is empty. <a href="shop.html">Shop now</a>.</td></tr>');
            updateSummary();
            return;
        }

        const fragment = document.createDocumentFragment();
        cart.forEach((item, index) => {
            const subtotal = (item.price * item.quantity).toFixed(2);
            const $row = $(`
                <tr>
                    <td class="align-middle"><img src="${sanitizeInput(item.image)}" alt="${sanitizeInput(item.name)}" style="width: 50px;"> ${sanitizeInput(item.name)}</td>
                    <td class="align-middle">$${item.price.toFixed(2)}</td>
                    <td class="align-middle">${sanitizeInput(item.size)}</td>
                    <td class="align-middle">${sanitizeInput(item.color)}</td>
                    <td class="align-middle">
                        <div class="input-group quantity mx-auto" style="width: 100px;">
                            <div class="input-group-btn">
                                <button class="btn btn-sm btn-primary btn-minus" aria-label="Decrease quantity">
                                    <i class="fa fa-minus"></i>
                                </button>
                            </div>
                            <input type="text" class="form-control form-control-sm bg-secondary border-0 text-center" value="${item.quantity}" readonly aria-label="Quantity">
                            <div class="input-group-btn">
                                <button class="btn btn-sm btn-primary btn-plus" aria-label="Increase quantity">
                                    <i class="fa fa-plus"></i>
                                </button>
                            </div>
                        </div>
                    </td>
                    <td class="align-middle">$${subtotal}</td>
                    <td class="align-middle"><button class="btn btn-sm btn-danger remove-item" data-index="${index}" aria-label="Remove ${sanitizeInput(item.name)}"><i class="fa fa-times"></i></button></td>
                </tr>
            `);
            fragment.appendChild($row[0]);
        });
        $cartItems[0].appendChild(fragment);

        updateSummary();
        updateCartBadge();
    }

    function updateSummary() {
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        let subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const couponDiscount = parseFloat(localStorage.getItem('couponDiscount')) || 0;
        const shipping = cart.length > 0 ? 10 : 0;
        const total = Math.max(0, subtotal - couponDiscount + shipping);

        $('#subtotal').text(`$${subtotal.toFixed(2)}`);
        $('#coupon-discount').text(couponDiscount > 0 ? `-$${couponDiscount.toFixed(2)}` : '$0.00');
        $('#shipping').text(`$${shipping.toFixed(2)}`);
        $('#total').text(`$${total.toFixed(2)}`);
    }

    function applyCoupon() {
        const code = $('#coupon-code').val().trim().toUpperCase();
        const coupons = {
            'SAVE10': 10,
            'SAVE20': 20
        };
        if (coupons[code]) {
            localStorage.setItem('couponDiscount', coupons[code]);
            alert(`Coupon applied! $${coupons[code]} discount.`);
        } else {
            localStorage.removeItem('couponDiscount');
            alert('Invalid coupon code.');
        }
        $('#coupon-code').val('');
        updateSummary();
    }

    $(document).ready(function () {
        if (typeof window.ethereum !== 'undefined') {
            console.log('Web3 provider detected. Ensuring no interference.');
        }

        setTimeout(renderCart, 100);

        $(document).off('click', '.quantity button').on('click', '.quantity button', function () {
            const $button = $(this);
            const $input = $button.closest('.quantity').find('input');
            let value = parseInt($input.val(), 10) || 1;
            const index = $button.closest('tr').find('.remove-item').data('index');
            let cart = JSON.parse(localStorage.getItem('cart')) || [];

            if ($button.hasClass('btn-plus')) {
                value++;
            } else if ($button.hasClass('btn-minus') && value > 1) {
                value--;
            }

            if (cart[index]) {
                cart[index].quantity = value;
                localStorage.setItem('cart', JSON.stringify(cart));
                renderCart();
            }
        });

        $(document).off('click', '.remove-item').on('click', '.remove-item', function () {
            if (confirm('Are you sure you want to remove this item?')) {
                const index = $(this).data('index');
                let cart = JSON.parse(localStorage.getItem('cart')) || [];
                cart.splice(index, 1);
                localStorage.setItem('cart', JSON.stringify(cart));
                renderCart();
            }
        });

        $('#apply-coupon').off('click').on('click', function (e) {
            e.preventDefault();
            setTimeout(applyCoupon, 100);
        });

        $('#checkout-btn').off('click').on('click', function () {
            const cart = JSON.parse(localStorage.getItem('cart')) || [];
            if (cart.length === 0) {
                alert('Your cart is empty.');
                window.location.href = 'shop.html';
            } else {
                window.location.href = 'checkout.html';
            }
        });
    });
})(jQuery);