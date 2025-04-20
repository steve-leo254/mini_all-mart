(function ($) {
    "use strict";

    // Configuration constants
    const CONFIG = {
        CURRENCY: 'ksh',
        navbarBreakpoint: 992,
        backToTopOffset: 100,
        scrollTopSpeed: 1500,
        scrollThrottleDelay: 150,
        resizeDebounceDelay: 250,
        carouselMargin: 29,
        renderDelay: 100
    };

    // Product data
    const products = [
        { id: 1, name: "Nikon Camera", price: 25000, image: "img/product-1.jpg", rating: 5, category: "devices", description: "A comfortable camera for every shot." },
        { id: 2, name: "Blue Jacket", price: 1500, image: "img/product-2.jpg", rating: 4.5, category: "jackets", description: "Stylish denim jacket for a trendy look." },
        { id: 3, name: "Stand Lamp", price: 1200, image: "img/product-3.jpg", rating: 3.5, category: "accessories", description: "Lighten your world." },
        { id: 4, name: "Black Sneakers", price: 2500, image: "img/product-4.jpg", rating: 2, category: "shoes", description: "Elegant sneakers for formal occasions." },
        { id: 5, name: "Drone", price: 100000, image: "img/product-5.jpg", rating: 5, category: "devices", description: "Aero-stylish drone for stunning photos." },
        { id: 6, name: "Smart Watch", price: 3095, image: "img/product-6.jpg", rating: 4.5, category: "devices", description: "Track every second with style." },
        { id: 7, name: "Formal Shirt", price: 3704, image: "img/product-7.jpg", rating: 3.5, category: "shirts", description: "Crisp shirt for professional settings." },
        { id: 8, name: "Beauty Cream", price: 569, image: "img/product-8.jpg", rating: 2, category: "accessories", description: "Smoothens and protects your skin." },
        { id: 9, name: "Chinos", price: 1444, image: "img/product-9.jpg", rating: 2, category: "accessories", description: "Versatile chinos for a comfy seat." }
    ];

    // Utility: Debounce a function to limit execution rate
    const debounce = (func, wait, immediate) => {
        let timeout;
        return function () {
            const context = this, args = arguments;
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    };

    // Utility: Throttle a function to limit execution frequency
    const throttle = (func, limit) => {
        let inThrottle;
        return function () {
            const context = this, args = arguments;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    };

    // Parse URL query parameters
    const getUrlParams = () => {
        const params = new URLSearchParams(window.location.search);
        return {
            id: parseInt(params.get('id')) || null,
            category: params.get('category') || '',
            price: params.get('price') || '',
            search: params.get('search') || '',
            sort: params.get('sort') || ''
        };
    };

    // Filter products based on URL parameters
    const filterProducts = () => {
        const { category, price, search, sort } = getUrlParams();
        let filtered = [...products];

        if (category) {
            filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase());
        }

        if (price) {
            const [min, max] = price.split('-').map(Number);
            filtered = filtered.filter(p => p.price >= min && (!max || p.price <= max));
        }

        if (search) {
            const query = search.toLowerCase();
            filtered = filtered.filter(p => p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query));
        }

        if (sort) {
            filtered.sort((a, b) => {
                if (sort === 'name-asc') return a.name.localeCompare(b.name);
                if (sort === 'price-asc') return a.price - b.price;
                if (sort === 'price-desc') return b.price - a.price;
                return 0;
            });
        }

        return filtered;
    };

    // Update cart badge with total items
    const updateCartBadge = () => {
        try {
            const cart = JSON.parse(localStorage.getItem('cart') || '[]');
            const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
            $('.fas.fa-shopping-cart').next('.badge').text(totalItems);
        } catch (e) {
            console.error('Failed to update cart badge:', e);
        }
    };

    // Sanitize input to prevent XSS
    const sanitizeInput = (input) => {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    };

    // Validate and repair cart data
    const validateAndRepairCart = () => {
        try {
            let cart = JSON.parse(localStorage.getItem('cart') || '[]');
            cart = cart.map((item, index) => {
                if (!item || typeof item.id === 'undefined') {
                    console.warn(`Removing invalid cart item at index ${index}:`, item);
                    return null;
                }
                return {
                    id: item.id,
                    name: item.name || `Product ${item.id}`,
                    price: Number.isFinite(item.price) && item.price > 0 ? item.price : 10000,
                    image: item.image || 'img/product-1.jpg',
                    quantity: Math.max(1, Math.floor(item.quantity || 1)),
                    size: item.size || 'M',
                    color: item.color || 'Black'
                };
            }).filter(Boolean);
            localStorage.setItem('cart', JSON.stringify(cart));
            if (cart.length === 0) localStorage.removeItem('couponDiscount');
            return cart;
        } catch (e) {
            console.error('Failed to validate cart:', e);
            localStorage.setItem('cart', '[]');
            return [];
        }
    };

    // Generate star rating HTML
    const generateStarRating = (rating) => {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5 ? 1 : 0;
        const emptyStars = 5 - fullStars - halfStar;
        return (
            '<small class="fas fa-star text-primary mr-1"></small>'.repeat(fullStars) +
            (halfStar ? '<small class="fas fa-star-half-alt text-primary mr-1"></small>' : '') +
            '<small class="far fa-star text-primary mr-1"></small>'.repeat(emptyStars)
        );
    };

    // Render products to a container
    const renderProducts = (containerId, productList) => {
        const $container = $(`#${containerId}`);
        $container.empty();

        if (!productList.length) {
            $container.html('<div class="col-12 text-center">No products found.</div>');
            return;
        }

        const fragment = document.createDocumentFragment();
        productList.forEach(product => {
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
                                <h5>${CONFIG.CURRENCY}${product.price.toFixed(2)}</h5>
                            </div>
                            <div class="d-flex align-items-center justify-content-center mb-1">
                                ${generateStarRating(product.rating)}
                                <small>(${product.rating})</small>
                            </div>
                        </div>
                    </div>
                </div>
            `);
            fragment.appendChild($item[0]);
        });
        $container[0].appendChild(fragment);
    };

    // Render product details
    const renderProductDetails = (product) => {
        $('#product-name').text(sanitizeInput(product.name));
        $('#product-price').text(`${CONFIG.CURRENCY}${product.price.toFixed(2)}`);
        $('#main-image').attr({ src: product.image, alt: sanitizeInput(product.name) });
        $('#product-description').text(sanitizeInput(product.description));
        $('#description-tab').text(sanitizeInput(product.description));
        $('#review-product-name').text(sanitizeInput(product.name));
        $('#product-rating').html(generateStarRating(product.rating));
    };

    // Render product carousel
    const renderProductCarousel = (product, relatedProducts) => {
        const $carousel = $('.carousel-inner');
        $carousel.empty();
        const images = [product.image, ...relatedProducts.map(p => p.image)];
        const fragment = document.createDocumentFragment();
        images.forEach((img, index) => {
            const $item = $(`
                <div class="carousel-item ${index === 0 ? 'active' : ''}">
                    <img class="w-100 h-100" src="${img}" alt="${index === 0 ? sanitizeInput(product.name) : 'Related Product'}">
                </div>
            `);
            fragment.appendChild($item[0]);
        });
        $carousel[0].appendChild(fragment);
    };

    // Render related products
    const renderRelatedProducts = (relatedProducts) => {
        const $container = $('#related-products');
        $container.empty();
        const fragment = document.createDocumentFragment();
        relatedProducts.forEach(p => {
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
                            <h5>${CONFIG.CURRENCY}${p.price.toFixed(2)}</h5>
                        </div>
                        <div class="d-flex align-items-center justify-content-center mb-1">
                            ${generateStarRating(p.rating)}
                            <small>(${p.rating})</small>
                        </div>
                    </div>
                </div>
            `);
            fragment.appendChild($item[0]);
        });
        $container[0].appendChild(fragment);

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
    };

    // Render detail page
    const renderDetailPage = () => {
        const { id } = getUrlParams();
        const product = products.find(p => p.id === id) || products[0];
        const relatedProducts = products.filter(p => p.id !== product.id).sort(() => Math.random() - 0.5).slice(0, 3);

        renderProductDetails(product);
        renderProductCarousel(product, relatedProducts);
        renderRelatedProducts(relatedProducts);
    };

    // Render checkout page
    const renderCheckoutPage = () => {
        const cart = validateAndRepairCart();
        const $productsContainer = $('#order-products');
        const $subtotal = $('#order-subtotal');
        const $shipping = $('#order-shipping');
        const $discount = $('#cart-discount');
        const $total = $('#order-total');

        $productsContainer.empty().append('<h6 class="mb-3">Products</h6>');
        let subtotal = 0;

        if (!cart.length) {
            $productsContainer.append('<p>Your cart is empty. <a href="shop.html">Shop now</a>.</p>');
            $subtotal.text(`${CONFIG.CURRENCY}0.00`);
            $shipping.text(`${CONFIG.CURRENCY}0.00`);
            $discount.text(`${CONFIG.CURRENCY}0.00`);
            $total.text(`${CONFIG.CURRENCY}0.00`);
            return;
        }

        const fragment = document.createDocumentFragment();
        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            subtotal += itemTotal;
            const $item = $(`
                <div class="d-flex justify-content-between">
                    <p>${sanitizeInput(item.name)} (${sanitizeInput(item.size)}, ${sanitizeInput(item.color)}, Qty: ${item.quantity})</p>
                    <p>${CONFIG.CURRENCY}${itemTotal.toFixed(2)}</p>
                </div>
            `);
            fragment.appendChild($item[0]);
        });
        $productsContainer[0].appendChild(fragment);

        const shipping = cart.length > 0 ? 10 : 0;
        const couponDiscount = parseFloat(localStorage.getItem('couponDiscount')) || 0;
        const total = Math.max(0, subtotal + shipping - couponDiscount);

        $subtotal.text(`${CONFIG.CURRENCY}${subtotal.toFixed(2)}`);
        $shipping.text(`${CONFIG.CURRENCY}${shipping.toFixed(2)}`);
        $discount.text(`${CONFIG.CURRENCY}${couponDiscount.toFixed(2)}`);
        $total.text(`${CONFIG.CURRENCY}${total.toFixed(2)}`);
    };

    // Validate checkout form
    const validateCheckoutForm = () => {
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

    // Initialize page
    $(document).ready(() => {
        if (typeof window.ethereum !== 'undefined') {
            console.log('Web3 provider detected. Ensuring no interference.');
        }

        // Render products based on current page
        const renderPageProducts = () => {
            const page = window.location.pathname.split('/').pop() || 'index.html';
            if (page === 'index.html') {
                renderProducts('featured-products', products.slice(0, 8));
                renderProducts('recent-products', products.slice(0, 8).reverse());
            } else if (page === 'shop.html') {
                renderProducts('products', filterProducts());
            } else if (page === 'detail.html') {
                renderDetailPage();
            } else if (page === 'checkout.html') {
                renderCheckoutPage();
            }
        };

        setTimeout(renderPageProducts, CONFIG.renderDelay);

        // Toggle navbar dropdown behavior
        const toggleNavbarMethod = () => {
            const $dropdowns = $('.navbar .dropdown');
            if ($(window).width() > CONFIG.navbarBreakpoint) {
                $dropdowns.off('mouseover mouseout').on({
                    mouseover() {
                        const $toggle = $(this).find('.dropdown-toggle').first();
                        if (!$(this).hasClass('show')) $toggle.trigger('click');
                    },
                    mouseout() {
                        const $toggle = $(this).find('.dropdown-toggle').first();
                        $toggle.trigger('click').blur();
                    }
                });
            } else {
                $dropdowns.off('mouseover mouseout');
            }
        };

        toggleNavbarMethod();
        $(window).resize(debounce(toggleNavbarMethod, CONFIG.resizeDebounceDelay));

        // Back-to-top button
        const $backToTop = $('.back-to-top');
        $(window).scroll(throttle(() => {
            $backToTop.fadeToggle('slow', $(window).scrollTop() > CONFIG.backToTopOffset ? 'show' : 'hide');
        }, CONFIG.scrollThrottleDelay));

        $backToTop.off('click').on('click', (e) => {
            e.preventDefault();
            $('html, body').animate({ scrollTop: 0 }, CONFIG.scrollTopSpeed, 'easeInOutExpo');
        });

        // Initialize vendor carousel
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

        // Quantity buttons
        $(document).off('click', '.quantity button').on('click', '.quantity button', function () {
            const $input = $(this).closest('.quantity').find('input');
            let value = parseInt($input.val(), 10) || 1;
            value = $(this).hasClass('btn-plus') ? value + 1 : Math.max(1, value - 1);
            $input.val(value).trigger('change');
        });

        // Add to cart
        $(document).off('click', '.add-to-cart').on('click', '.add-to-cart', function (e) {
            e.preventDefault();
            const productId = parseInt($(this).data('id'));
            const product = products.find(p => p.id === productId);
            if (!product) {
                console.error('Product not found:', productId);
                return;
            }

            let size = 'M', color = 'Black', quantity = 1;
            if ($(this).closest('.h-100').length) { // Detail page
                size = $('input[name="size"]:checked').val();
                color = $('input[name="color"]:checked').val();
                quantity = parseInt($('#quantity').val(), 10) || 1;

                if (!size || !color) {
                    alert('Please select a size and color.');
                    return;
                }
            }

            const cart = validateAndRepairCart();
            const existingItem = cart.find(item => item.id === productId && item.size === size && item.color === color);

            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                cart.push({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image: product.image,
                    quantity,
                    size,
                    color
                });
            }

            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartBadge();
            alert(`${sanitizeInput(product.name)} added to cart!`);
        });

        // Place order
        $(document).off('click', '#place-order').on('click', '#place-order', function (e) {
            e.preventDefault();
            const cart = validateAndRepairCart();

            if (!cart.length) {
                alert('Your cart is empty. Please add items to proceed.');
                window.location.href = 'shop.html';
                return;
            }

            const errors = validateCheckoutForm();
            if (errors.length) {
                alert(`Please fix the following errors:\n- ${errors.join('\n- ')}`);
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
                subtotal: parseFloat($('#order-subtotal').text().replace(CONFIG.CURRENCY, '')),
                shipping: parseFloat($('#order-shipping').text().replace(CONFIG.CURRENCY, '')),
                couponDiscount: parseFloat($('#cart-discount').text().replace(CONFIG.CURRENCY, '')),
                total: parseFloat($('#order-total').text().replace(CONFIG.CURRENCY, '')),
                paymentMethod: $('input[name="payment"]:checked').val()
            };

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

        updateCartBadge();
    });
})(jQuery);