from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from flask_wtf.csrf import CSRFProtect
from db import db, Products, Customers, Sales, SaleDetails, Payments
import json
from decimal import Decimal
from datetime import datetime

# Initialize Flask app
app = Flask(__name__, template_folder='.')
app.config["SQLALCHEMY_DATABASE_URI"] = 'postgresql://postgres:leo.steve@localhost:5432/online_shop'
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.secret_key = "Techcamp"

# Initialize CSRF protection
csrf = CSRFProtect(app)

# Initialize database with app
db.init_app(app)

# Helper function to convert Decimal to float for JSON serialization


def decimal_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError


@app.route('/')
def index():
    featured_products = Products.query.limit(
        8).all()  # Fetch 8 featured products
    recent_products = Products.query.order_by(
        Products.product_id.desc()).limit(8).all()  # Fetch 8 recent products
    return render_template("index.html", featured_products=featured_products, recent_products=recent_products)


@app.route('/products', methods=['GET'])
def get_products():
    products = Products.query.all()
    return jsonify([{
        'id': p.product_id,
        'name': p.product_name,
        'price': float(p.selling_price),
        'image': p.image,
        'category': p.category,
        'rating': 4.5,  # Static rating (adjust if model supports)
        'description': 'Sample description'  # Add description if available in model
    } for p in products], default=decimal_default)


@app.route('/shop')
def shop():
    category = request.args.get('category')
    price_range = request.args.get('price')
    sort = request.args.get('sort')
    search = request.args.get('search')

    query = Products.query

    if category:
        query = query.filter_by(category=category)
    if price_range:
        min_price, max_price = map(int, price_range.split('-'))
        query = query.filter(
            Products.selling_price.between(min_price, max_price))
    if search:
        query = query.filter(Products.product_name.ilike(f'%{search}%'))
    if sort == 'name-asc':
        query = query.order_by(Products.product_name.asc())
    elif sort == 'price-asc':
        query = query.order_by(Products.selling_price.asc())
    elif sort == 'price-desc':
        query = query.order_by(Products.selling_price.desc())

    products = query.all()
    return render_template('shop.html', products=products)


@app.route('/cart', methods=['GET', 'POST'])
def cart():
    if request.method == 'POST':
        # Handle cart updates from client-side (e.g., via AJAX)
        data = request.get_json()
        action = data.get('action')
        product_id = data.get('product_id')
        quantity = data.get('quantity', 1)
        size = data.get('size')
        color = data.get('color')

        # Verify CSRF token
        if data.get('csrf_token') != session.get('csrf_token'):
            return jsonify({'error': 'Invalid CSRF token'}), 403

        # Initialize cart in session if not exists
        if 'cart' not in session:
            session['cart'] = []

        cart = session['cart']
        product = Products.query.get(product_id)

        if not product:
            return jsonify({'error': 'Product not found'}), 404

        if action == 'add':
            # Check stock availability
            if product.stock_quantity < quantity:
                return jsonify({'error': 'Insufficient stock'}), 400
            cart_item = next(
                (item for item in cart if item['product_id'] == product_id and item['size'] == size and item['color'] == color), None)
            if cart_item:
                cart_item['quantity'] += quantity
            else:
                cart.append({
                    'product_id': product_id,
                    'name': product.product_name,
                    'price': float(product.selling_price),
                    'image': product.image,
                    'quantity': quantity,
                    'size': size,
                    'color': color
                })
        elif action == 'update':
            cart_item = next(
                (item for item in cart if item['product_id'] == product_id and item['size'] == size and item['color'] == color), None)
            if cart_item and quantity > 0:
                if product.stock_quantity < quantity:
                    return jsonify({'error': 'Insufficient stock'}), 400
                cart_item['quantity'] = quantity
            elif cart_item:
                cart.remove(cart_item)
        elif action == 'remove':
            cart[:] = [item for item in cart if not (
                item['product_id'] == product_id and item['size'] == size and item['color'] == color)]

        session['cart'] = cart
        session.modified = True
        return jsonify({'cart': cart, 'message': 'Cart updated successfully'})

    # Render cart page
    cart = session.get('cart', [])
    return render_template('cart.html', cart=cart)


@app.route('/coupon', methods=['POST'])
def apply_coupon():
    data = request.get_json()
    code = data.get('code', '').upper()
    # Verify CSRF token
    if data.get('csrf_token') != session.get('csrf_token'):
        return jsonify({'error': 'Invalid CSRF token'}), 403

    coupons = {'SAVE10': 10, 'SAVE20': 20}  # Hardcoded for simplicity
    if code in coupons:
        session['coupon_discount'] = coupons[code]
        session.modified = True
        return jsonify({'message': f'Coupon applied! KSH {coupons[code]} discount', 'discount': coupons[code]})
    return jsonify({'error': 'Invalid coupon code'}), 400


@app.route('/checkout', methods=['GET', 'POST'])
def checkout():
    if request.method == 'POST':
        # Process checkout form (AJAX or form submission)
        if request.is_json:
            data = request.get_json()
            # Verify CSRF token
            if data.get('csrf_token') != session.get('csrf_token'):
                return jsonify({'error': 'Invalid CSRF token'}), 403
            billing = {
                'first_name': data.get('billing-first-name'),
                'last_name': data.get('billing-last-name'),
                'email': data.get('billing-email'),
                'mobile': data.get('billing-mobile'),
                'address1': data.get('billing-address1'),
                'address2': data.get('billing-address2'),
                'country': data.get('billing-country'),
                'city': data.get('billing-city'),
                'state': data.get('billing-state'),
                'zip': data.get('billing-zip')
            }
            shipping = data.get('shipping')
            payment_method = data.get('payment')
            cart = session.get('cart', [])
            coupon_discount = float(data.get('coupon-discount', 0))
            subtotal = float(data.get('subtotal', 0))
            shipping_cost = float(data.get('shipping', 0))
            total = float(data.get('total', 0))
        else:
            billing = {
                'first_name': request.form.get('billing-first-name'),
                'last_name': request.form.get('billing-last-name'),
                'email': request.form.get('billing-email'),
                'mobile': request.form.get('billing-mobile'),
                'address1': request.form.get('billing-address1'),
                'address2': request.form.get('billing-address2'),
                'country': request.form.get('billing-country'),
                'city': request.form.get('billing-city'),
                'state': request.form.get('billing-state'),
                'zip': request.form.get('billing-zip')
            }
            shipping = {
                'first_name': request.form.get('shipping-first-name'),
                'last_name': request.form.get('shipping-last-name'),
                'email': request.form.get('shipping-email'),
                'mobile': request.form.get('shipping-mobile'),
                'address1': request.form.get('shipping-address1'),
                'address2': request.form.get('shipping-address2'),
                'country': request.form.get('shipping-country'),
                'city': request.form.get('shipping-city'),
                'state': request.form.get('shipping-state'),
                'zip': request.form.get('shipping-zip')
            } if request.form.get('shipto') else None
            payment_method = request.form.get('payment')
            cart = session.get('cart', [])
            coupon_discount = float(session.get('coupon_discount', 0))
            # Calculate subtotal and shipping
            subtotal = sum(item['price'] * item['quantity'] for item in cart)
            shipping_cost = 10 if cart else 0  # Fixed shipping cost
            total = max(0, subtotal + shipping_cost - coupon_discount)

        if not cart:
            return jsonify({'error': 'Cart is empty'}), 400

        # Validate billing details
        if not all([billing['first_name'], billing['last_name'], billing['email'], billing['mobile'], billing['address1'], billing['country'], billing['city'], billing['state'], billing['zip']]):
            return jsonify({'error': 'Missing required billing fields'}), 400

        # Validate shipping details if provided
        if shipping and not all([shipping['first_name'], shipping['last_name'], shipping['address1'], shipping['country'], shipping['city'], shipping['state'], shipping['zip']]):
            return jsonify({'error': 'Missing required shipping fields'}), 400

        # Create or find customer
        customer = Customers.query.filter_by(email=billing['email']).first()
        if not customer:
            customer = Customers(
                full_name=f"{billing['first_name']} {billing['last_name']}",
                phone_no=billing['mobile'],
                email=billing['email']
            )
            db.session.add(customer)
            db.session.commit()

        # Create sale
        sale = Sales(
            customer_id=customer.customer_id,
            total_amount=total,
            created_at=datetime.utcnow()
        )
        db.session.add(sale)
        db.session.commit()

        # Create sale details
        for item in cart:
            product = Products.query.get(item['product_id'])
            if product.stock_quantity < item['quantity']:
                db.session.rollback()
                return jsonify({'error': f'Insufficient stock for {product.product_name}'}), 400
            sale_detail = SaleDetails(
                sale_id=sale.sale_id,
                product_id=item['product_id'],
                quantity=item['quantity'],
                purchase_amount=item['price'] * item['quantity']
            )
            product.stock_quantity -= item['quantity']  # Update stock
            db.session.add(sale_detail)

        # Create payment
        payment = Payments(
            sale_id=sale.sale_id,
            customer_id=customer.customer_id,
            payment_method=payment_method,
            amount=total
        )
        db.session.add(payment)

        # Commit transaction
        try:
            db.session.commit()
            # Clear cart and coupon
            session['cart'] = []
            session.pop('coupon_discount', None)
            session.modified = True
            if request.is_json:
                return jsonify({'message': 'Order placed successfully', 'sale_id': sale.sale_id})
            return redirect(url_for('index'))
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

    # Render checkout page
    cart = session.get('cart', [])
    coupon_discount = session.get('coupon_discount', 0)
    subtotal = sum(item['price'] * item['quantity'] for item in cart)
    shipping_cost = 10 if cart else 0
    total = max(0, subtotal + shipping_cost - coupon_discount)
    return render_template('checkout.html', cart=cart, subtotal=subtotal, shipping_cost=shipping_cost, coupon_discount=coupon_discount, total=total)

@app.template_filter('format_currency')
def format_currency(value):
     return f"KSH {float(value):.2f}"

if __name__ == '__main__':
    with app.app_context():
        db.create_all()  # Create tables if they don't exist
    app.run(debug=True)
