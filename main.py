import logging
import os
from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from flask_wtf.csrf import CSRFProtect, generate_csrf
from db import db, Products, Customers, Sales, SaleDetails, Payments, Coupons
from decimal import Decimal
from datetime import datetime
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import BadRequest, NotFound

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__, template_folder='templates')
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URI", "postgresql://postgres:leo.steve@localhost:5432/online_shop")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "Techcamp")  # Use environment variable in production
app.config["PER_PAGE"] = 20  # Products per page for pagination

# Initialize CSRF protection
csrf = CSRFProtect(app)

# Initialize database
db.init_app(app)

# Helper function for JSON serialization of Decimal
def decimal_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError

@app.before_request
def set_csrf_token():
    """Generate and store CSRF token in session for AJAX requests."""
    if 'csrf_token' not in session:
        session['csrf_token'] = generate_csrf()


@app.route('/')
def index():
    try:
        featured_products = Products.query.limit(8).all()
        recent_products = Products.query.order_by(Products.product_id.desc()).limit(8).all()
        # Add categories query (example - adjust based on your data model)
        categories = db.session.query(Products.category).distinct().all()
        categories = [c[0] for c in categories]  # Extract category strings
        
        return render_template(
            "index.html",
            featured_products=featured_products,
            recent_products=recent_products,
            categories=categories,  # Add this line
            csrf_token=session.get('csrf_token')
        )
    except Exception as e:
        logger.error(f"Error rendering index: {str(e)}")
        return render_template("error.html", error="Failed to load homepage"), 500
    


@app.route('/products', methods=['GET'])
def get_products():
    """Return all products as JSON."""
    try:
        products = Products.query.all()
        return jsonify([
            {
                'id': p.product_id,
                'name': p.product_name,
                'price': float(p.selling_price),
                'image': p.image,
                'category': p.category,
                'rating': float(p.rating) if p.rating is not None else 4.5,
                'description': p.description or "No description available"
            } for p in products
        ], default=decimal_default)
    except Exception as e:
        logger.error(f"Error fetching products: {str(e)}")
        return jsonify({'error': 'Failed to fetch products'}), 500

@app.route('/shop')
def shop():
    """Render the shop page with filtered and paginated products."""
    try:
        category = request.args.get('category')
        price_range = request.args.get('price')
        sort = request.args.get('sort')
        search = request.args.get('search')
        page = request.args.get('page', 1, type=int)

        query = Products.query

        # Apply filters
        if category:
            query = query.filter_by(category=category)
        if price_range:
            try:
                min_price, max_price = map(int, price_range.split('-'))
                if min_price < 0 or max_price < min_price:
                    raise ValueError("Invalid price range")
                query = query.filter(Products.selling_price.between(min_price, max_price))
            except ValueError:
                logger.warning(f"Invalid price range: {price_range}")
                return jsonify({'error': 'Invalid price range'}), 400
        if search:
            query = query.filter(Products.product_name.ilike(f'%{search}%'))
        if sort == 'name-asc':
            query = query.order_by(Products.product_name.asc())
        elif sort == 'price-asc':
            query = query.order_by(Products.selling_price.asc())
        elif sort == 'price-desc':
            query = query.order_by(Products.selling_price.desc())

        # Paginate results
        pagination = query.paginate(page=page, per_page=app.config["PER_PAGE"], error_out=False)
        products = pagination.items

        return render_template(
            'shop.html',
            products=products,
            pagination=pagination,
            csrf_token=session.get('csrf_token')
        )
    except Exception as e:
        logger.error(f"Error rendering shop page: {str(e)}")
        return render_template("error.html", error="Failed to load shop"), 500

@app.route('/cart', methods=['GET', 'POST'])
def cart():
    """Manage cart operations (add, update, remove) and render cart page."""
    if request.method == 'POST':
        try:
            data = request.get_json()
            if not data:
                raise BadRequest("Invalid JSON data")

            action = data.get('action')
            product_id = data.get('product_id', type=int)
            quantity = data.get('quantity', 1, type=int)
            size = data.get('size')
            color = data.get('color')

            # Validate CSRF token
            if data.get('csrf_token') != session.get('csrf_token'):
                logger.warning("Invalid CSRF token in cart request")
                return jsonify({'error': 'Invalid CSRF token'}), 403

            # Validate inputs
            if not product_id or quantity < 1:
                raise BadRequest("Invalid product ID or quantity")

            # Initialize cart
            if 'cart' not in session:
                session['cart'] = []

            cart = session['cart']
            product = Products.query.get(product_id)

            if not product:
                raise NotFound("Product not found")

            if action == 'add':
                if product.stock_quantity < quantity:
                    return jsonify({'error': f'Insufficient stock for {product.product_name}'}), 400
                cart_item = next(
                    (item for item in cart if item['product_id'] == product_id and item['size'] == size and item['color'] == color),
                    None
                )
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
                    (item for item in cart if item['product_id'] == product_id and item['size'] == size and item['color'] == color),
                    None
                )
                if cart_item and quantity > 0:
                    if product.stock_quantity < quantity:
                        return jsonify({'error': f'Insufficient stock for {product.product_name}'}), 400
                    cart_item['quantity'] = quantity
                elif cart_item:
                    cart.remove(cart_item)
            elif action == 'remove':
                cart[:] = [item for item in cart if not (
                    item['product_id'] == product_id and item['size'] == size and item['color'] == color)]
            else:
                raise BadRequest("Invalid action")

            session['cart'] = cart
            session.modified = True
            logger.info(f"Cart updated: action={action}, product_id={product_id}")
            return jsonify({'cart': cart, 'message': 'Cart updated successfully'})
        except BadRequest as e:
            return jsonify({'error': str(e)}), 400
        except NotFound as e:
            return jsonify({'error': str(e)}), 404
        except Exception as e:
            logger.error(f"Error updating cart: {str(e)}")
            return jsonify({'error': 'Failed to update cart'}), 500

    # Render cart page
    cart = session.get('cart', [])
    return render_template('cart.html', cart=cart, csrf_token=session.get('csrf_token'))

@app.route('/coupon', methods=['POST'])
def apply_coupon():
    """Apply a coupon code for a discount."""
    try:
        data = request.get_json()
        if not data:
            raise BadRequest("Invalid JSON data")

        code = data.get('code', '').upper()

        # Validate CSRF token
        if data.get('csrf_token') != session.get('csrf_token'):
            logger.warning("Invalid CSRF token in coupon request")
            return jsonify({'error': 'Invalid CSRF token'}), 403

        # Check coupon in database
        coupon = Coupons.query.filter_by(code=code).first()
        if not coupon:
            logger.info(f"Invalid coupon code: {code}")
            return jsonify({'error': 'Invalid coupon code'}), 400

        session['coupon_discount'] = float(coupon.discount)
        session.modified = True
        logger.info(f"Coupon applied: {code}, discount={coupon.discount}")
        return jsonify({
            'message': f'Coupon applied! KSH {float(coupon.discount):.2f} discount',
            'discount': float(coupon.discount)
        })
    except BadRequest as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error applying coupon: {str(e)}")
        return jsonify({'error': 'Failed to apply coupon'}), 500

@app.route('/checkout', methods=['GET', 'POST'])
def checkout():
    """Handle checkout process and render checkout page."""
    if request.method == 'POST':
        try:
            # Process checkout form (AJAX or form submission)
            if request.is_json:
                data = request.get_json()
                if not data:
                    raise BadRequest("Invalid JSON data")
                # Validate CSRF token
                if data.get('csrf_token') != session.get('csrf_token'):
                    logger.warning("Invalid CSRF token in checkout request")
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
                subtotal = sum(item['price'] * item['quantity'] for item in cart)
                shipping_cost = 10 if cart else 0
                total = max(0, subtotal + shipping_cost - coupon_discount)

            if not cart:
                raise BadRequest("Cart is empty")

            # Validate billing details
            if not all([billing['first_name'], billing['last_name'], billing['email'], billing['mobile'], billing['address1'], billing['country'], billing['city'], billing['state'], billing['zip']]):
                raise BadRequest("Missing required billing fields")

            # Validate shipping details if provided
            if shipping and not all([shipping['first_name'], shipping['last_name'], shipping['address1'], shipping['country'], shipping['city'], shipping['state'], shipping['zip']]):
                raise BadRequest("Missing required shipping fields")

            # Validate payment method
            if not payment_method:
                raise BadRequest("Payment method is required")

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
                if not product:
                    db.session.rollback()
                    raise NotFound(f"Product ID {item['product_id']} not found")
                if product.stock_quantity < item['quantity']:
                    db.session.rollback()
                    return jsonify({'error': f'Insufficient stock for {product.product_name}'}), 400
                sale_detail = SaleDetails(
                    sale_id=sale.sale_id,
                    product_id=item['product_id'],
                    quantity=item['quantity'],
                    purchase_amount=item['price'] * item['quantity']
                )
                product.stock_quantity -= item['quantity']
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
            db.session.commit()
            session['cart'] = []
            session.pop('coupon_discount', None)
            session.modified = True
            logger.info(f"Order placed successfully: sale_id={sale.sale_id}")
            if request.is_json:
                return jsonify({'message': 'Order placed successfully', 'sale_id': sale.sale_id})
            return redirect(url_for('index'))
        except BadRequest as e:
            return jsonify({'error': str(e)}), 400
        except NotFound as e:
            return jsonify({'error': str(e)}), 404
        except IntegrityError as e:
            db.session.rollback()
            logger.error(f"Database integrity error during checkout: {str(e)}")
            return jsonify({'error': 'Failed to process order due to database error'}), 500
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error during checkout: {str(e)}")
            return jsonify({'error': 'Failed to process order'}), 500

    # Render checkout page
    try:
        cart = session.get('cart', [])
        coupon_discount = session.get('coupon_discount', 0)
        subtotal = sum(item['price'] * item['quantity'] for item in cart)
        shipping_cost = 10 if cart else 0
        total = max(0, subtotal + shipping_cost - coupon_discount)
        return render_template(
            'checkout.html',
            cart=cart,
            subtotal=subtotal,
            shipping_cost=shipping_cost,
            coupon_discount=coupon_discount,
            total=total,
            csrf_token=session.get('csrf_token')
        )
    except Exception as e:
        logger.error(f"Error rendering checkout page: {str(e)}")
        return render_template("error.html", error="Failed to load checkout page"), 500

@app.template_filter('format_currency')
def format_currency(value):
    """Format a value as KSH currency."""
    return f"KSH {float(value):.2f}"


@app.route("/error")
def error():
    return render_template("error.html")





with app.app_context():
        db.create_all()  # Create tables if they don't exist


if __name__ == '__main__':
    
    app.run(debug=True)