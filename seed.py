import json
import logging
import os
from flask import Flask
from db import db, Products

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URI", "postgresql://postgres:leo.steve@localhost:5432/online_shop")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db.init_app(app)

def seed_products():
    """Seed the Products table from product.json."""
    try:
        with open('data/product.json', 'r') as file:
            products_data = json.load(file)
    except FileNotFoundError:
        logger.error("product.json not found in data directory")
        return
    except json.JSONDecodeError:
        logger.error("Invalid JSON format in product.json")
        return

    with app.app_context():
        for product in products_data:
            existing_product = Products.query.filter_by(product_id=product['id']).first()
            if existing_product:
                logger.info(f"Product {product['name']} already exists, skipping")
                continue
            db_product = Products(
                product_id=product['id'],
                product_name=product['name'],
                buying_price=product['price'] * 0.8,  # Assume 80% of selling price
                selling_price=product['price'],
                stock_quantity=100,  # Default stock quantity
                image=product['image'],
                category=product['category'],
                rating=product['rating'],
                description=product['description']
            )
            db.session.add(db_product)

        try:
            db.session.commit()
            logger.info("Products seeded successfully!")
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error seeding products: {str(e)}")
            raise

if __name__ == '__main__':
    seed_products()