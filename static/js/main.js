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
        maxCartItems: 50,
        productsUrl: '/products',
        ajaxDebounceDelay: 300,
        maxAjaxRetries: 3,
        retryDelay: 1000,
        shippingCost: 10
    };

    // Placeholder for product data
    let products = [];

    // Expose utilities globally
    window.sanitizeInput = input => {
        if (typeof input !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML.replace(/[<>]/g, '');
    };

    window.formatCurrency = amount => {
        return new Intl.NumberFormat(CONFIG.LOCALE, {
            style: 'currency',
            currency: CONFIG.CURRENCY
        }).format(amount);
    };

    // Get CSRF token
    const getCsrfToken = () => {
        return $('meta[name="csrf-token"]').attr('content') || $('input[name="csrf_token"]').val() || '';
    };

    // Fetch products with retry
    const fetchProducts = async () => {
        let attempt = 1;
        while (attempt <= CONFIG.maxAjaxRetries) {
            try {
                console.log(`Attempt ${attempt} to fetch products from:`, CONFIG.productsUrl);
                const response = await fetch(CONFIG.productsUrl, {
                    headers: { 'X-CSRF-Token': getCsrfToken() }
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                products = await response.json();
                if (!Array.isArray(products) || products.length === 0) {
                    throw new Error('Invalid or empty product data');
                }
                products.forEach(product => {
                    if (!product.id || !product.name || !Number.isFinite(product.price)) {
                        console.warn('Invalid product:', product);
                    }
                });
                console.log('Products fetched successfully:', products.length, 'items');
                return;
            } catch (error) {
                console.error(`Attempt ${attempt} failed:`, error.message);
                if (attempt === CONFIG.maxAjaxRetries) {
                    console.error('All fetch attempts failed. Using fallback data.');
                    products = [
                        {"id":1,"name":"Nikon Camera","price":25000,"image":"img/product-1.jpg","rating":5,"category":"devices","description":"A comfortable camera for every shot."},
                        {"id":2,"name":"Blue Jacket","price":1500,"image":"img/product-2.jpg","rating":4.5,"category":"jackets","description":"Stylish denim jacket for a trendy look."},
                        {"id":3,"name":"Stand Lamp","price":1200,"image":"img/product-3.jpg","rating":3.5,"category":"accessories","description":"Lighten your world."}
                    ];
                }
                attempt++;
                await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
            }
        }
    };

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

    // Parse URL query parameters
    const getUrlParams = () => {
        const params = new URLSearchParams(window.location.search);
        return {
            id: parseInt(params.get('id')) || null,
            category: params.get('category') || '',
            price: params.get('price') || '',
            search: params.get('search') || '',
            sort: params.get('sort') || '',
            page: parseInt(params.get('page')) || 1
        };
    };

    // Filter and paginate products
    const filterProducts = () => {
        const { category, price, search, sort, page } = getUrlParams();
        let filtered = [...products];
        const itemsPerPage = 12;

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

        const totalPages = Math.ceil(filtered.length / itemsPerPage);
        const start = (page - 1) * itemsPerPage;
        const paginated = filtered.slice(start, start + itemsPerPage);

        return { products: paginated, totalPages, currentPage: page };
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

    // Render categories dynamically
    const renderCategories = () => {
        const categories = [...new Set(products.map(p => p.category))];
        const container = document.getElementById('category-list');
        if (!container) return;
        container.innerHTML = categories.map(category => `
            <div class="col-lg-3 col-md-4 col-sm-6 pb-1">
                <a class="text-decoration-none" href="shop.html?category=${category}">
                    <div class="cat-item d-flex align-items-center mb-4">
                        <div class="overflow-hidden" style="width: 100px; height: 100px;">
                            <img class="img-fluid" src="img/cat-${category}.jpg" alt="${window.sanitizeInput(category)}" loading="lazy" onerror="this.src='img/cat-1.jpg'">
                        </div>
                        <div class="flex-fill pl-3">
                            <h6>${window.sanitizeInput(category.charAt(0).toUpperCase() + category.slice(1))}</h6>
                            <small class="text-body">${products.filter(p => p.category === category).length} Products</small>
                        </div>
                    </div>
                </a>
            </div>
        `).join('');
        $(container).attr('aria-live', 'polite');
    };

    // Render pagination
    const renderPagination = (totalPages, currentPage) => {
        const container = document.getElementById('pagination');
        if (!container || totalPages <= 1) return;

        const { category, price, search, sort } = getUrlParams();
        const baseUrl = `shop.html?${category ? `category=${category}&` : ''}${price ? `price=${price}&` : ''}${search ? `search=${search}&` : ''}${sort ? `sort=${sort}&` : ''}`;

        let html = '<nav aria-label="Shop pagination"><ul class="pagination">';
        html += `<li class="page-item${currentPage === 1 ? ' disabled' : ''}">
            <a class="page-link" href="${baseUrl}page=${currentPage - 1}" aria-label="Previous page">Previous</a>
        </li>`;

        for (let i = 1; i <= totalPages; i++) {
            html += `<li class="page-item${i === currentPage ? ' active' : ''}">
                <a class="page-link" href="${baseUrl}page=${i}">${i}</a>
            </li>`;
        }

        html += `<li class="page-item${currentPage === totalPages ? ' disabled' : ''}">
            <a class="page-link" href="${baseUrl}page=${currentPage + 1}" aria-label="Next page">Next</a>
        </li>`;
        html += '</ul></nav>';

        container.innerHTML = html;
    };

    // Render products
    const renderProducts = (containerId, productList, totalPages, currentPage) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = productList.length ? '' : '<div class="col-12 text-center" role="alert">No products found.</div>';

        const html = productList.map(product => `
            <div class="col-lg-4 col-md-6 col-sm-6 pb-1">
                <div class="product-item bg-light mb-4" role="article">
                    <div class="product-img position-relative overflow-hidden">
                        <img class="img-fluid w-100" src="${window.sanitizeInput(product.image)}" alt="${window.sanitizeInput(product.name)}" loading="lazy" onerror="this.src='img/cat-1.jpg'">
                        <div class="product-action">
                            <button class="btn btn-outline-dark btn-square add-to-cart" data-id="${product.id}" aria-label="Add ${window.sanitizeInput(product.name)} to cart"><i class="fa fa-shopping-cart"></i></button>
                            <a class="btn btn-outline-dark btn-square" href="wishlist.html" aria-label="Add ${window.sanitizeInput(product.name)} to wishlist"><i class="far fa-heart"></i></a>
                            <a class="btn btn-outline-dark btn-square" href="detail.html?id=${product.id}" aria-label="View ${window.sanitizeInput(product.name)} details"><i class="fa fa-search"></i></a>
                        </div>
                    </div>
                    <div class="text-center py-4">
                        <a class="h6 text-decoration-none text-truncate" href="detail.html?id=${product.id}">${window.sanitizeInput(product.name)}</a>
                        <div class="d-flex align-items-center justify-content-center mt-2">
                            <h5>${window.formatCurrency(product.price)}</h5>
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
        $(container).attr('aria-live', 'polite');

        renderPagination(totalPages, currentPage);
    };

    // Render product details
    const renderProductDetails = (product) => {
        $('#product-name').text(window.sanitizeInput(product.name));
        $('#product-price').text(window.formatCurrency(product.price));
        $('#main-image').attr('src', window.sanitizeInput(product.image)).attr('alt', window.sanitizeInput(product.name));
        $('#product-description').text(window.sanitizeInput(product.description));
        $('#description-tab').text(window.sanitizeInput(product.description));
        $('#review-product-name').text(window.sanitizeInput(product.name));
        $('#product-rating').html(generateStarRating(product.rating));
    };

    // Render product carousel
    const renderProductCarousel = (product, relatedProducts) => {
        const carousel = $('.carousel-inner');
        if (!carousel.length) return;

        const images = [product.image, ...relatedProducts.map(p => p.image)];
        carousel.html(images.map((img, index) => `
            <div class="carousel-item ${index === 0 ? 'active' : ''}">
                <img class="w-100 h-100" src="${window.sanitizeInput(img)}" alt="${index === 0 ? window.sanitizeInput(product.name) : 'Related Product'}" loading="lazy" onerror="this.src='img/cat-1.jpg'">
            </div>
        `).join(''));
    };

    // Render related products
    const renderRelatedProducts = (relatedProducts) => {
        const container = $('#related-products');
        if (!container.length) return;

        container.html(relatedProducts.map(p => `
            <div class="product-item bg-light" role="article">
                <div class="product-img position-relative overflow-hidden">
                    <img class="img-fluid w-100" src="${window.sanitizeInput(p.image)}" alt="${window.sanitizeInput(p.name)}" loading="lazy" onerror="this.src='img/cat-1.jpg'">
                    <div class="product-action">
                        <button class="btn btn-outline-dark btn-square add-to-cart" data-id="${p.id}" aria-label="Add ${window.sanitizeInput(p.name)} to cart"><i class="fa fa-shopping-cart"></i></button>
                        <a class="btn btn-outline-dark btn-square" href="wishlist.html" aria-label="Add ${window.sanitizeInput(p.name)} to wishlist"><i class="far fa-heart"></i></a>
                        <a class="btn btn-outline-dark btn-square" href="detail.html?id=${p.id}" aria-label="View ${window.sanitizeInput(p.name)} details"><i class="fa fa-search"></i></a>
                    </div>
                </div>
                <div class="text-center py-4">
                    <a class="h6 text-decoration-none text-truncate" href="detail.html?id=${p.id}">${window.sanitizeInput(p.name)}</a>
                    <div class="d-flex align-items-center justify-content-center mt-2">
                        <h5>${window.formatCurrency(p.price)}</h5>
                    </div>
                    <div class="d-flex align-items-center justify-content-center mb-1">
                        ${generateStarRating(p.rating)}
                        <small>(${p.rating})</small>
                    </div>
                </div>
            </div>
        `).join(''));

        if ($('.related-carousel').hasClass('owl-loaded')) {
            $('.related-carousel').trigger('destroy.owl.carousel').removeClass('owl-carousel owl-loaded');
            $('.related-carousel').find('.owl-stage-outer').children().unwrap();
        }

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
        const product = products.find(p => p.id === id) || products[0] || {};
        const relatedProducts = products.filter(p => p.id !== product.id && p.category === product.category).slice(0, 3);

        renderProductDetails(product);
        renderProductCarousel(product, relatedProducts);
        renderRelatedProducts(relatedProducts);
    };

    // Render checkout page
    const renderCheckoutPage = async () => {
        const cart = await fetchCart();
        const $productsContainer = $('#order-products');
        const $subtotal = $('#order-subtotal');
        const $shipping = $('#order-shipping');
        const $discount = $('#cart-discount');
        const $total = $('#order-total');

        $productsContainer.empty().append('<h6 class="mb-3">Products</h6>').attr('aria-live', 'polite');
        let subtotal = 0;

        if (!cart.length) {
            $productsContainer.append('<p>Your cart is empty. <a href="shop.html">Shop now</a>.</p>');
            $subtotal.text(window.formatCurrency(0));
            $shipping.text(window.formatCurrency(0));
            $discount.text(window.formatCurrency(0));
            $total.text(window.formatCurrency(0));
            return;
        }

        const fragment = document.createDocumentFragment();
        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            subtotal += itemTotal;
            const $item = $(`
                <div class="d-flex justify-content-between">
                    <p>${window.sanitizeInput(item.name)} (${window.sanitizeInput(item.size)}, ${window.sanitizeInput(item.color)}, Qty: ${item.quantity})</p>
                    <p>${window.formatCurrency(itemTotal)}</p>
                </div>
            `);
            fragment.appendChild($item[0]);
        });
        $productsContainer[0].appendChild(fragment);

        const shipping = cart.length > 0 ? CONFIG.shippingCost : 0;
        const couponDiscount = parseFloat(localStorage.getItem('couponDiscount')) || 0; // Fallback
        const total = Math.max(0, subtotal + shipping - couponDiscount);

        $subtotal.text(window.formatCurrency(subtotal));
        $shipping.text(window.formatCurrency(shipping));
        $discount.text(window.formatCurrency(couponDiscount));
        $total.text(window.formatCurrency(total));
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

    // Debounced add to cart
    const debouncedAddToCart = debounce(async (productId, size, color, quantity) => {
        let attempt = 1;
        while (attempt <= CONFIG.maxAjaxRetries) {
            try {
                const response = await $.post({
                    url: '/cart',
                    data: JSON.stringify({
                        action: 'add',
                        product_id: productId,
                        quantity,
                        size,
                        color,
                        csrf_token: getCsrfToken()
                    }),
                    contentType: 'application/json',
                    dataType: 'json'
                });
                await updateCartBadge();
                showError(response.message, true);
                return;
            } catch (e) {
                console.error(`Attempt ${attempt} to add to cart failed:`, e);
                if (attempt === CONFIG.maxAjaxRetries) {
                    showError('Failed to add to cart. Please try again.');
                    return;
                }
                attempt++;
                await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
            }
        }
    }, CONFIG.ajaxDebounceDelay);

    // Initialize page
    $(document).ready(async () => {
        try {
            if (typeof window.ethereum !== 'undefined') {
                console.log('Web3 provider detected. No interaction performed.');
            }
        } catch (e) {
            console.warn('Web3 provider check failed:', e);
        }

        await fetchProducts();
        renderCategories();
        await updateCartBadge();

        const renderPageProducts = () => {
            const page = window.location.pathname.split('/').pop() || 'index.html';
            if (page === 'index.html') {
                renderProducts('featured-products', products.slice(0, 8), 1, 1);
                renderProducts('recent-products', products.slice(0, 8).reverse(), 1, 1);
            } else if (page === 'shop.html') {
                const { products: filtered, totalPages, currentPage } = filterProducts();
                renderProducts('products', filtered, totalPages, currentPage);
            } else if (page === 'detail.html') {
                renderDetailPage();
            } else if (page === 'checkout.html') {
                renderCheckoutPage();
            }
        };

        setTimeout(renderPageProducts, CONFIG.renderDelay);

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

        const $backToTop = $('.back-to-top');
        let isBackToTopVisible = $backToTop.is(':visible');
        $(window).scroll(throttle(() => {
            const shouldBeVisible = $(window).scrollTop() > CONFIG.backToTopOffset;
            if (shouldBeVisible !== isBackToTopVisible) {
                $backToTop.stop(true).fadeToggle('slow', () => {
                    isBackToTopVisible = shouldBeVisible;
                });
            }
        }, CONFIG.scrollThrottleDelay));

        $backToTop.off('click').on('click', (e) => {
            e.preventDefault();
            $('html, body').animate({ scrollTop: 0 }, CONFIG.scrollTopSpeed, 'easeInOutExpo');
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
            },
            onInitialized: function () {
                $('.vendor-carousel').attr('role', 'region').attr('aria-label', 'Vendor Carousel');
            }
        });

        $(document).off('click', '.quantity button').on('click', '.quantity button', function () {
            const $input = $(this).closest('.quantity').find('input');
            let value = parseInt($input.val(), 10) || 1;
            value = $(this).hasClass('btn-plus') ? value + 1 : Math.max(1, value - 1);
            $input.val(value).trigger('change');
        });

        $(document).off('click', '.add-to-cart').on('click', async function (e) {
            e.preventDefault();
            const productId = parseInt($(this).data('id'));
            const product = products.find(p => p.id === productId);
            if (!product) {
                console.error('Product not found:', productId);
                showError('Product not found. Please try again.');
                return;
            }

            let size = 'M', color = 'Black', quantity = 1;
            if ($(this).closest('.h-100').length) {
                size = $('input[name="size"]:checked').val();
                color = $('input[name="color"]:checked').val();
                quantity = parseInt($('#quantity').val(), 10) || 1;

                if (!size || !color) {
                    showError('Please select a size and color.');
                    return;
                }
            }

            debouncedAddToCart(productId, size, color, quantity);
        });

        $(document).off('click', '#place-order').on('click', async function (e) {
            e.preventDefault();
            const cart = await fetchCart();

            if (!cart.length) {
                showError('Your cart is empty. Please add items to proceed.');
                window.location.href = 'shop.html';
                return;
            }

            const errors = validateCheckoutForm();
            if (errors.length) {
                return;
            }

            const orderDetails = {
                'billing-first-name': window.sanitizeInput($('#billing-first-name').val()),
                'billing-last-name': window.sanitizeInput($('#billing-last-name').val()),
                'billing-email': window.sanitizeInput($('#billing-email').val()),
                'billing-mobile': window.sanitizeInput($('#billing-mobile').val()),
                'billing-address1': window.sanitizeInput($('#billing-address1').val()),
                'billing-address2': window.sanitizeInput($('#billing-address2').val()),
                'billing-country': window.sanitizeInput($('#billing-country').val()),
                'billing-city': window.sanitizeInput($('#billing-city').val()),
                'billing-state': window.sanitizeInput($('#billing-state').val()),
                'billing-zip': window.sanitizeInput($('#billing-zip').val()),
                shipping: $('#shipto').is(':checked') ? {
                    'shipping-first-name': window.sanitizeInput($('#shipping-first-name').val()),
                    'shipping-last-name': window.sanitizeInput($('#shipping-last-name').val()),
                    'shipping-email': window.sanitizeInput($('#shipping-email').val()),
                    'shipping-mobile': window.sanitizeInput($('#shipping-mobile').val()),
                    'shipping-address1': window.sanitizeInput($('#shipping-address1').val()),
                    'shipping-address2': window.sanitizeInput($('#shipping-address2').val()),
                    'shipping-country': window.sanitizeInput($('#shipping-country').val()),
                    'shipping-city': window.sanitizeInput($('#shipping-city').val()),
                    'shipping-state': window.sanitizeInput($('#shipping-state').val()),
                    'shipping-zip': window.sanitizeInput($('#shipping-zip').val())
                } : null,
                items: cart,
                subtotal: parseFloat($('#order-subtotal').text().replace(/[^\d.]/g, '')),
                shipping: parseFloat($('#order-shipping').text().replace(/[^\d.]/g, '')),
                'coupon-discount': parseFloat($('#cart-discount').text().replace(/[^\d.]/g, '')),
                total: parseFloat($('#order-total').text().replace(/[^\d.]/g, '')),
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