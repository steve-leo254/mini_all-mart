(function ($) {
    "use strict";

    // Configuration constants
    const CONFIG = {
        CURRENCY: 'KSH',
        LOCALE: 'en-KE',
        navbarBreakpoint: 992,
        backToTopOffset: 100,
        scrollTopSpeed: 1500,
        scrollThrottleDelay: 150,
        resizeDebounceDelay: 250,
        carouselMargin: 29,
        renderDelay: 100,
        maxCartItems: 50
    };

    // Product data (to be replaced with API call in production)
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

    // Utility: Debounce a function
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

    // Utility: Throttle a function
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

    // Utility: Format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat(CONFIG.LOCALE, {
            style: 'currency',
            currency: CONFIG.CURRENCY
        }).format(amount);
    };

    // Utility: Sanitize input
    const sanitizeInput = (input) => {
        if (typeof input !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML.replace(/[<>]/g, '');
    };

    // Utility: Check storage availability
    const isStorageAvailable = (type) => {
        try {
            const storage = window[type];
            const test = '__storage_test__';
            storage.setItem(test, test);
            storage.removeItem(test);
            return true;
        } catch (e) {
            console.warn(`${type} is not available:`, e);
            return false;
        }
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

    // Filter products
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

    // Update cart badge
    const updateCartBadge = () => {
        try {
            const cart = JSON.parse(localStorage.getItem('cart') || '[]');
            const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
            document.querySelectorAll('.fas.fa-shopping-cart + .badge').forEach(badge => {
                badge.textContent = totalItems;
            });
        } catch (e) {
            console.error('Failed to update cart badge:', e);
            alert('Unable to update cart. Please try again later.');
        }
    };

    // Validate and repair cart
    const validateAndRepairCart = () => {
        if (!isStorageAvailable('localStorage')) {
            alert('Local storage is not available. Cart functionality may be limited.');
            return [];
        }

        try {
            let cart = JSON.parse(localStorage.getItem('cart') || '[]');
            cart = cart.slice(0, CONFIG.maxCartItems).map((item, index) => {
                if (!item || typeof item.id === 'undefined') {
                    console.warn(`Removing invalid cart item at index ${index}:`, item);
                    return null;
                }
                const product = products.find(p => p.id === item.id);
                return {
                    id: item.id,
                    name: product ? product.name : item.name || `Product ${item.id}`,
                    price: product ? product.price : (Number.isFinite(item.price) && item.price > 0 ? item.price : 10000),
                    image: product ? product.image : item.image || 'img/product-1.jpg',
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
            alert('Cart data corrupted. Resetting cart.');
            return [];
        }
    };

    // Generate star rating HTML
    const generateStarRating = (rating) => {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5 ? 1 : 0;
        const emptyStars = 5 - fullStars - halfStar;
        return `
            ${'<small class="fas fa-star text-primary mr-1" aria-hidden="true"></small>'.repeat(fullStars)}
            ${halfStar ? '<small class="fas fa-star-half-alt text-primary mr-1" aria-hidden="true"></small>' : ''}
            ${'<small class="far fa-star text-primary mr-1" aria-hidden="true"></small>'.repeat(emptyStars)}
            <span class="sr-only">Rating: ${rating} out of 5</span>
        `;
    };

    // Render products
    const renderProducts = (containerId, productList) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = productList.length ? '' : '<div class="col-12 text-center" role="alert">No products found.</div>';

        const html = productList.map(product => `
            <div class="col-lg-4 col-md-6 col-sm-6 pb-1">
                <div class="product-item bg-light mb-4" role="article">
                    <div class="product-img position-relative overflow-hidden">
                        <img class="img-fluid w-100" src="${product.image}" alt="${sanitizeInput(product.name)}">
                        <div class="product-action">
                            <button class="btn btn-outline-dark btn-square add-to-cart" data-id="${product.id}" aria-label="Add ${sanitizeInput(product.name)} to cart"><i class="fa fa-shopping-cart"></i></button>
                            <a class="btn btn-outline-dark btn-square" href="wishlist.html" aria-label="Add ${sanitizeInput(product.name)} to wishlist"><i class="far fa-heart"></i></a>
                            <a class="btn btn-outline-dark btn-square" href="detail.html?id=${product.id}" aria-label="View ${sanitizeInput(product.name)} details"><i class="fa fa-search"></i></a>
                        </div>
                    </div>
                    <div class="text-center py-4">
                        <a class="h6 text-decoration-none text-truncate" href="detail.html?id=${product.id}">${sanitizeInput(product.name)}</a>
                        <div class="d-flex align-items-center justify-content-center mt-2">
                            <h5>${formatCurrency(product.price)}</h5>
                        </div>
                        <div class="d-flex align-items-center justify-content-center mb-1">
                            ${generateStarRating(product.rating)}
                            <small>(${product.rating})</small>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        container.insertAdjacentHTML('beforeend', html);
    };

    // Render product details
    const renderProductDetails = (product) => {
        document.getElementById('product-name').textContent = sanitizeInput(product.name);
        document.getElementById('product-price').textContent = formatCurrency(product.price);
        const mainImage = document.getElementById('main-image');
        mainImage.src = product.image;
        mainImage.alt = sanitizeInput(product.name);
        document.getElementById('product-description').textContent = sanitizeInput(product.description);
        document.getElementById('description-tab').textContent = sanitizeInput(product.description);
        document.getElementById('review-product-name').textContent = sanitizeInput(product.name);
        document.getElementById('product-rating').innerHTML = generateStarRating(product.rating);
    };

    // Render product carousel
    const renderProductCarousel = (product, relatedProducts) => {
        const carousel = document.querySelector('.carousel-inner');
        if (!carousel) return;

        const images = [product.image, ...relatedProducts.map(p => p.image)];
        carousel.innerHTML = images.map((img, index) => `
            <div class="carousel-item ${index === 0 ? 'active' : ''}">
                <img class="w-100 h-100" src="${img}" alt="${index === 0 ? sanitizeInput(product.name) : 'Related Product'}">
            </div>
        `).join('');
    };

    // Render related products
    const renderRelatedProducts = (relatedProducts) => {
        const container = document.getElementById('related-products');
        if (!container) return;

        container.innerHTML = relatedProducts.map(p => `
            <div class="product-item bg-light" role="article">
                <div class="product-img position-relative overflow-hidden">
                    <img class="img-fluid w-100" src="${p.image}" alt="${sanitizeInput(p.name)}">
                    <div class="product-action">
                        <button class="btn btn-outline-dark btn-square add-to-cart" data-id="${p.id}" aria-label="Add ${sanitizeInput(p.name)} to cart"><i class="fa fa-shopping-cart"></i></button>
                        <a class="btn btn-outline-dark btn-square" href="wishlist.html" aria-label="Add ${sanitizeInput(p.name)} to wishlist"><i class="far fa-heart"></i></a>
                        <a class="btn btn-outline-dark btn-square" href="detail.html?id=${p.id}" aria-label="View ${sanitizeInput(p.name)} details"><i class="fa fa-search"></i></a>
                    </div>
                </div>
                <div class="text-center py-4">
                    <a class="h6 text-decoration-none text-truncate" href="detail.html?id=${p.id}">${sanitizeInput(p.name)}</a>
                    <div class="d-flex align-items-center justify-content-center mt-2">
                        <h5>${formatCurrency(p.price)}</h5>
                    </div>
                    <div class="d-flex align-items-center justify-content-center mb-1">
                        ${generateStarRating(p.rating)}
                        <small>(${p.rating})</small>
                    </div>
                </div>
            </div>
        `).join('');

        // Destroy existing carousel to prevent memory leaks
        if ($('.related-carousel').hasClass('owl-loaded')) {
            $('.related-carousel').trigger('destroy.owl.carousel').removeClass('owl-carousel owl-loaded');
            $('.related-carousel').find('.owl-stage-outer').children().unwrap();
        }

        // Initialize Owl Carousel with accessibility
        $('.related-carousel').owlCarousel({
            loop: relatedProducts.length > 1,
            margin: CONFIG.carouselMargin,
            nav: true,
            navText: [
                '<i class="fa fa-angle-left" aria-hidden="true"></i><span class="sr-only">Previous</span>',
                '<i class="fa fa-angle-right" aria-hidden="true"></i><span class="sr-only">Next</span>'
            ],
            autoplay: true,
            smartSpeed: 1000,
            responsive: {
                0: { items: 1 },
                600: { items: 2 },
                1000: { items: 3 }
            },
            onInitialized: function () {
                $('.related-carousel').attr('role', 'region').attr('aria-label', 'Related Products Carousel');
            }
        });
    };

    // Render detail page
    const renderDetailPage = () => {
        const { id } = getUrlParams();
        const product = products.find(p => p.id === id) || products[0];
        const relatedProducts = products.filter(p => p.id !== product.id && p.category === product.category).slice(0, 3);

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
            $subtotal.text(formatCurrency(0));
            $shipping.text(formatCurrency(0));
            $discount.text(formatCurrency(0));
            $total.text(formatCurrency(0));
            return;
        }

        const fragment = document.createDocumentFragment();
        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            subtotal += itemTotal;
            const $item = $(`
                <div class="d-flex justify-content-between">
                    <p>${sanitizeInput(item.name)} (${sanitizeInput(item.size)}, ${sanitizeInput(item.color)}, Qty: ${item.quantity})</p>
                    <p>${formatCurrency(itemTotal)}</p>
                </div>
            `);
            fragment.appendChild($item[0]);
        });
        $productsContainer[0].appendChild(fragment);

        const shipping = cart.length > 0 ? 10 : 0;
        const couponDiscount = parseFloat(localStorage.getItem('couponDiscount')) || 0;
        const total = Math.max(0, subtotal + shipping - couponDiscount);

        $subtotal.text(formatCurrency(subtotal));
        $shipping.text(formatCurrency(shipping));
        $discount.text(formatCurrency(couponDiscount));
        $total.text(formatCurrency(total));
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
            const value = $(`#${field.id}`).val().trim();
            if (!value) {
                errors.push(`${field.name} is required.`);
                $(`#${field.id}`).addClass('is-invalid');
            } else {
                $(`#${field.id}`).removeClass('is-invalid');
            }
        });

        const email = $('#billing-email').val().trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('Please enter a valid email address.');
            $('#billing-email').addClass('is-invalid');
        } else {
            $('#billing-email').removeClass('is-invalid');
        }

        const mobile = $('#billing-mobile').val().trim();
        if (mobile && !/^\+?\d{10,15}$/.test(mobile)) {
            errors.push('Please enter a valid mobile number (10-15 digits).');
            $('#billing-mobile').addClass('is-invalid');
        } else {
            $('#billing-mobile').removeClass('is-invalid');
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
                    $(`#${field.id}`).addClass('is-invalid');
                } else {
                    $(`#${field.id}`).removeClass('is-invalid');
                }
            });

            const shippingEmail = $('#shipping-email').val().trim();
            if (shippingEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shippingEmail)) {
                errors.push('Please enter a valid shipping email address.');
                $('#shipping-email').addClass('is-invalid');
            } else {
                $('#shipping-email').removeClass('is-invalid');
            }

            const shippingMobile = $('#shipping-mobile').val().trim();
            if (shippingMobile && !/^\+?\d{10,15}$/.test(shippingMobile)) {
                errors.push('Please enter a valid shipping mobile number.');
                $('#shipping-mobile').addClass('is-invalid');
            } else {
                $('#shipping-mobile').removeClass('is-invalid');
            }
        }

        if (!$('input[name="payment"]:checked').length) {
            errors.push('Please select a payment method.');
            $('input[name="payment"]').closest('.form-group').addClass('is-invalid');
        } else {
            $('input[name="payment"]').closest('.form-group').removeClass('is-invalid');
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
            },
            onInitialized: function () {
                $('.vendor-carousel').attr('role', 'region').attr('aria-label', 'Vendor Carousel');
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
                alert('Product not found. Please try again.');
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
                subtotal: parseFloat($('#order-subtotal').text().replace(/[^\d.]/g, '')),
                shipping: parseFloat($('#order-shipping').text().replace(/[^\d.]/g, '')),
                couponDiscount: parseFloat($('#cart-discount').text().replace(/[^\d.]/g, '')),
                total: parseFloat($('#order-total').text().replace(/[^\d.]/g, '')),
                paymentMethod: $('input[name="payment"]:checked').val()
            };

            localStorage.removeItem('cart');
            localStorage.removeItem('couponDiscount');

            alert(`Order placed successfully!\n\nOrder Details:\n` +
                `Name: ${orderDetails.billing.firstName} ${orderDetails.billing.lastName}\n` +
                `Email: ${orderDetails.billing.email}\n` +
                `Total: ${formatCurrency(orderDetails.total)}\n` +
                `Payment: ${orderDetails.paymentMethod}\n` +
                'Thank you for shopping with us!');

            window.location.href = 'index.html';
        });

        // Sync cart badge across tabs
        $(window).on('storage', (e) => {
            if (e.originalEvent.key === 'cart') {
                updateCartBadge();
            }
        });

        updateCartBadge();
    });
})(jQuery);