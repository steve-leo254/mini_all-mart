(function ($) {
    "use strict";

    const CONFIG = {
        navbarBreakpoint: 992,
        backToTopOffset: 100,
        scrollTopSpeed: 1500,
        scrollThrottleDelay: 150,
        resizeDebounceDelay: 250,
        carouselMargin: 29,
        renderDelay: 100
    };

    const products = [
        { id: 1, name: "Nikon-camera", price: 25000.99, image: "img/product-1.jpg", rating: 5, category: "devices", description: "A comfortable camera with every shot you take." },
        { id: 2, name: "Blue Jacket", price: 1500.99, image: "img/product-2.jpg", rating: 4.5, category: "jackets", description: "Stylish denim jacket for a trendy look." },
        { id: 3, name: "stand Lamp", price: 1200.99, image: "img/product-3.jpg", rating: 3.5, category: "accessories", description: "Lighten your world." },
        { id: 4, name: "black Sneakers", price: 2500.99, image: "img/product-4.jpg", rating: 2, category: "shoes", description: "Elegant sneakers shoes for formal occasions." },
        { id: 5, name: "Drone ", price: 100000.99, image: "img/product-5.jpg", rating: 5, category: "devices", description: "Aero stylish pic Cozy why not ." },
        { id: 6, name: "smart watch", price: 3095.99, image: "img/product-6.jpg", rating: 4.5, category: "devices", description: "let everysecond count." },
        { id: 7, name: "Formal Shirt", price: 3704.99, image: "img/product-7.jpg", rating: 3.5, category: "shirts", description: "Crisp formal shirt for professional settings." },
        { id: 8, name: "beauty cream", price: 569.99, image: "img/product-8.jpg", rating: 2, category: "accessories", description: "Protect your skin smoothening." },
        { id: 9, name: "Chinos Seat", price: 1444.99, image: "img/product-9.jpg", rating: 2, category: "accessories", description: "Versatile chinos for a smart-casual look." }
    ];

    function debounce(func, wait, immediate) {
        let timeout;
        return function executedFunction() {
            const context = this;
            const args = arguments;
            const later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }

    function throttle(func, limit) {
        let inThrottle;
        return function executedFunction() {
            const context = this;
            const args = arguments;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    function getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        return {
            id: parseInt(params.get('id')),
            category: params.get('category'),
            price: params.get('price'),
            search: params.get('search'),
            sort: params.get('sort')
        };
    }

    function filterProducts() {
        const { category, price, search, sort } = getUrlParams();
        let filtered = [...products];

        if (category) {
            filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase() || 
                (category.includes('dresses') && p.category === 'dresses'));
        }

        if (price) {
            const [min, max] = price.split('-').map(Number);
            filtered = filtered.filter(p => p.price >= min && (max ? p.price <= max : true));
        }

        if (search) {
            const query = search.toLowerCase();
            filtered = filtered.filter(p => p.name.toLowerCase().includes(query) || 
                p.category.toLowerCase().includes(query));
        }

        if (sort) {
            if (sort === 'name-asc') {
                filtered.sort((a, b) => a.name.localeCompare(b.name));
            } else if (sort === 'price-asc') {
                filtered.sort((a, b) => a.price - b.price);
            } else if (sort === 'price-desc') {
                filtered.sort((a, b) => b.price - a.price);
            }
        }

        return filtered;
    }

    function updateCartBadge() {
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
        $('.fas.fa-shopping-cart').next('.badge').text(totalItems);
    }

    function sanitizeInput(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
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
                image: item.image || 'img/product-1.jpg',
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

    function renderProducts(containerId, productList) {
        const $container = $(`#${containerId}`);
        $container.empty();
        if (productList.length === 0) {
            $container.html('<div class="col-12 text-center">No products found.</div>');
            return;
        }
        const fragment = document.createDocumentFragment();
        productList.forEach(product => {
            const stars = '<small class="fa fa-star text-primary mr-1"></small>'.repeat(Math.floor(product.rating)) +
                          (product.rating % 1 >= 0.5 ? '<small class="fa fa-star-half-alt text-primary mr-1"></small>' : '') +
                          '<small class="far fa-star text-primary mr-1"></small>'.repeat(5 - Math.ceil(product.rating));
            const $item = $(`
                <div class="col-lg-4 col-md-6 col-sm-6 pb-1">
                    <div class="product-item bg-light mb-4">
                        <div class="product-img position-relative overflow-hidden">
                            <img class="img-fluid w-100" src="${product.image}" alt="${sanitizeInput(product.name)}">
                            <div class="product-action">
                                <a class="btn btn-outline-dark btn-square add-to-cart" href="#" data-id="${product.id}"><i class="fa fa-shopping-cart"></i></a>
                                <a class="btn btn-outline-dark btn-square" href="wishlist.html"><i class="far fa-heart"></i></a>
                                <a class="btn btn-outline-dark btn-square" href="detail.html?id=${product.id}"><i class="fa fa-search"></i></a>
                            </div>
                        </div>
                        <div class="text-center py-4">
                            <a class="h6 text-decoration-none text-truncate" href="detail.html?id=${product.id}">${sanitizeInput(product.name)}</a>
                            <div class="d-flex align-items-center justify-content-center mt-2">
                                <h5>$${product.price.toFixed(2)}</h5>
                            </div>
                            <div class="d-flex align-items-center justify-content-center mb-1">
                                ${stars}
                                <small>(${product.rating})</small>
                            </div>
                        </div>
                    </div>
                </div>
            `);
            fragment.appendChild($item[0]);
        });
        $container[0].appendChild(fragment);
    }

    function renderDetailPage() {
        const { id } = getUrlParams();
        const product = products.find(p => p.id === id) || products[0];
        $('#product-name').text(sanitizeInput(product.name));
        $('#product-price').text(`$${product.price.toFixed(2)}`);
        $('#main-image').attr('src', product.image).attr('alt', sanitizeInput(product.name));
        $('#product-description').text(sanitizeInput(product.description));
        $('#description-tab').text(sanitizeInput(product.description));
        $('#review-product-name').text(sanitizeInput(product.name));

        const fullStars = Math.floor(product.rating);
        const halfStar = product.rating % 1 >= 0.5 ? 1 : 0;
        const emptyStars = 5 - fullStars - halfStar;
        let ratingHtml = '';
        ratingHtml += '<small class="fas fa-star text-primary mr-1"></small>'.repeat(fullStars);
        if (halfStar) ratingHtml += '<small class="fas fa-star-half-alt text-primary mr-1"></small>';
        ratingHtml += '<small class="far fa-star text-primary mr-1"></small>'.repeat(emptyStars);
        $('#product-rating').html(ratingHtml);

        const carouselImages = [product.image];
        const relatedProducts = products.filter(p => p.id !== product.id).sort(() => Math.random() - 0.5).slice(0, 3);
        carouselImages.push(...relatedProducts.map(p => p.image));
        const $carousel = $('.carousel-inner');
        $carousel.empty();
        const carouselFragment = document.createDocumentFragment();
        carouselImages.forEach((img, index) => {
            const $item = $(`
                <div class="carousel-item ${index === 0 ? 'active' : ''}">
                    <img class="w-100 h-100" src="${img}" alt="${index === 0 ? sanitizeInput(product.name) : 'Related Product'}">
                </div>
            `);
            carouselFragment.appendChild($item[0]);
        });
        $carousel[0].appendChild(carouselFragment);

        const relatedContainer = $('#related-products');
        relatedContainer.empty();
        const relatedFragment = document.createDocumentFragment();
        relatedProducts.forEach(p => {
            const stars = '<small class="fa fa-star text-primary mr-1"></small>'.repeat(Math.floor(p.rating)) +
                          (p.rating % 1 >= 0.5 ? '<small class="fa fa-star-half-alt text-primary mr-1"></small>' : '') +
                          '<small class="far fa-star text-primary mr-1"></small>'.repeat(5 - Math.ceil(p.rating));
            const $item = $(`
                <div class="product-item bg-light">
                    <div class="product-img position-relative overflow-hidden">
                        <img class="img-fluid w-100" src="${p.image}" alt="${sanitizeInput(p.name)}">
                        <div class="product-action">
                            <a class="btn btn-outline-dark btn-square add-to-cart" href="#" data-id="${p.id}"><i class="fa fa-shopping-cart"></i></a>
                            <a class="btn btn-outline-dark btn-square" href="wishlist.html"><i class="far fa-heart"></i></a>
                            <a class="btn btn-outline-dark btn-square" href="detail.html?id=${p.id}"><i class="fa fa-search"></i></a>
                        </div>
                    </div>
                    <div class="text-center py-4">
                        <a class="h6 text-decoration-none text-truncate" href="detail.html?id=${p.id}">${sanitizeInput(p.name)}</a>
                        <div class="d-flex align-items-center justify-content-center mt-2">
                            <h5>$${p.price.toFixed(2)}</h5>
                        </div>
                        <div class="d-flex align-items-center justify-content-center mb-1">
                            ${stars}
                            <small>(${p.rating})</small>
                        </div>
                    </div>
                </div>
            `);
            relatedFragment.appendChild($item[0]);
        });
        relatedContainer[0].appendChild(relatedFragment);

        $('.related-carousel').owlCarousel({
            loop: true,
            margin: CONFIG.carouselMargin,
            nav: true,
            autoplay: true,
            smartSpeed: 1000,
            responsive: {
                0: { items: 1 },
                600: { items: 3 },
                1000: { items: 4 }
            }
        });
    }

    function renderCheckoutPage() {
        const cart = validateAndRepairCart();
        const productsContainer = $('#order-products');
        const subtotalElement = $('#order-subtotal');
        const shippingElement = $('#order-shipping');
        const discountElement = $('#cart-discount');
        const totalElement = $('#order-total');

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
            const fragment = document.createDocumentFragment();
            cart.forEach(item => {
                const itemTotal = item.price * item.quantity;
                subtotal += itemTotal;
                const $item = $(`
                    <div class="d-flex justify-content-between">
                        <p>${sanitizeInput(item.name)} (${sanitizeInput(item.size)}, ${sanitizeInput(item.color)}, Qty: ${item.quantity})</p>
                        <p>$${itemTotal.toFixed(2)}</p>
                    </div>
                `);
                fragment.appendChild($item[0]);
            });
            productsContainer[0].appendChild(fragment);

            const shipping = cart.length > 0 ? 10.00 : 0.00;
            const couponDiscount = parseFloat(localStorage.getItem('couponDiscount')) || 0;
            const total = Math.max(0, subtotal + shipping - couponDiscount);

            subtotalElement.text(`$${subtotal.toFixed(2)}`);
            shippingElement.text(`$${shipping.toFixed(2)}`);
            discountElement.text(`$${couponDiscount.toFixed(2)}`);
            totalElement.text(`$${total.toFixed(2)}`);
        }
    }

    function validateCheckoutForm() {
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

        const mobile = $('#billing-mobile').val().trim();
        const mobileRegex = /^\+?\d{10,15}$/;
        if (mobile && !mobileRegex.test(mobile)) {
            errors.push('Please enter a valid mobile number (10-15 digits, optional +).');
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

            const shippingMobile = $('#shipping-mobile').val().trim();
            if (shippingMobile && !mobileRegex.test(shippingMobile)) {
                errors.push('Please enter a valid shipping mobile number.');
            }
        }

        if (!$('input[name="payment"]:checked').length) {
            errors.push('Please select a payment method.');
        }

        return errors;
    }

    $(document).ready(function () {
        if (typeof window.ethereum !== 'undefined') {
            console.log('Web3 provider detected. Ensuring no interference.');
        }

        function renderPageProducts() {
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            if (currentPage === 'index.html') {
                renderProducts('featured-products', products.slice(0, 8));
                renderProducts('recent-products', products.slice(0, 8).reverse());
            } else if (currentPage === 'shop.html') {
                const filteredProducts = filterProducts();
                renderProducts('products', filteredProducts);
            } else if (currentPage === 'detail.html') {
                renderDetailPage();
            } else if (currentPage === 'checkout.html') {
                renderCheckoutPage();
            }
        }

        setTimeout(renderPageProducts, CONFIG.renderDelay);

        function toggleNavbarMethod() {
            if ($(window).width() > CONFIG.navbarBreakpoint) {
                $('.navbar .dropdown').off('mouseover mouseout');
                $('.navbar .dropdown').on('mouseover', function () {
                    const toggle = $(this).find('.dropdown-toggle').first();
                    if (!$(this).hasClass('show')) {
                        toggle.trigger('click');
                    }
                }).on('mouseout', function () {
                    const toggle = $(this).find('.dropdown-toggle').first();
                    toggle.trigger('click').blur();
                });
            } else {
                $('.navbar .dropdown').off('mouseover mouseout');
            }
        }

        toggleNavbarMethod();
        $(window).resize(debounce(toggleNavbarMethod, CONFIG.resizeDebounceDelay));

        const $backToTop = $('.back-to-top');
        $(window).scroll(throttle(function () {
            if ($(window).scrollTop() > CONFIG.backToTopOffset) {
                $backToTop.fadeIn('slow');
            } else {
                $backToTop.fadeOut('slow');
            }
        }, CONFIG.scrollThrottleDelay));

        $backToTop.off('click').on('click', function (e) {
            e.preventDefault();
            $('html, body').animate({ scrollTop: 0 }, CONFIG.scrollTopSpeed, 'easeInOutExpo');
            return false;
        });

        $('.vendor-carousel').owlCarousel({
            loop: true,
            margin: CONFIG.carouselMargin,
            nav: false,
            autoplay: true,
            smartSpeed: 1000,
            responsive: {
                0: { items: 2 },
                576: { items: 3 },
                768: { items: 4 },
                992: { items: 5 },
                1200: { items: 6 }
            }
        });

        $(document).off('click', '.quantity button').on('click', '.quantity button', function () {
            const $button = $(this);
            const $quantityBlock = $button.closest('.quantity');
            const $inputField = $quantityBlock.find('input');
            const oldValue = parseInt($inputField.val(), 10) || 1;
            let newVal;

            if ($button.hasClass('btn-plus')) {
                newVal = oldValue + 1;
            } else {
                newVal = oldValue > 1 ? oldValue - 1 : 1;
            }

            $inputField.val(newVal).trigger('change');
        });

        $(document).off('click', '.add-to-cart').on('click', '.add-to-cart', function(e) {
            e.preventDefault();
            const productId = parseInt($(this).data('id'));
            const product = products.find(p => p.id === productId);
            if (!product) {
                console.error('Product not found:', productId);
                return;
            }

            let size = 'M';
            let color = 'Black';
            let quantity = 1;

            if ($(this).closest('.h-100').length) { // Detail page
                size = $('input[name="size"]:checked').val();
                color = $('input[name="color"]:checked').val();
                quantity = parseInt($('#quantity').val(), 10) || 1;

                if (!size || !color) {
                    alert('Please select a size and color.');
                    return;
                }
            }

            let cart = validateAndRepairCart();
            const existingItem = cart.find(item => item.id === productId && item.size === size && item.color === color);

            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                cart.push({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image: product.image,
                    quantity: quantity,
                    size: size,
                    color: color
                });
            }

            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartBadge();
            alert(`${sanitizeInput(product.name)} added to cart!`);
        });

        $(document).off('click', '#place-order').on('click', '#place-order', function(e) {
            e.preventDefault();
            const cart = validateAndRepairCart();

            if (cart.length === 0) {
                alert('Your cart is empty. Please add items to proceed.');
                window.location.href = 'shop.html';
                return;
            }

            const errors = validateCheckoutForm();
            if (errors.length > 0) {
                alert('Please fix the following errors:\n- ' + errors.join('\n- '));
                return;
            }

            const orderDetails = {
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
                subtotal: parseFloat($('#order-subtotal').text().replace('$', '')),
                shipping: parseFloat($('#order-shipping').text().replace('$', '')),
                couponDiscount: parseFloat($('#cart-discount').text().replace('$', '')),
                total: parseFloat($('#order-total').text().replace('$', '')),
                paymentMethod: $('input[name="payment"]:checked').val()
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

        updateCartBadge();
    });
})(jQuery);