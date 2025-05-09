import logging
import os
from flask import Flask
from db import db, Coupons

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

def seed_coupons():
    """Seed the Coupons table with initial data."""
    coupons_data = [
        {"code": "SAVE10", "discount": 10.00},
        {"code": "SAVE20", "discount": 20.00}
    ]

    with app.app_context():
        for coupon in coupons_data:
            existing_coupon = Coupons.query.filter_by(code=coupon["code"]).first()
            if existing_coupon:
                logger.info(f"Coupon {coupon['code']} already exists, skipping")
                continue
            db_coupon = Coupons(
                code=coupon["code"],
                discount=coupon["discount"]
            )
            db.session.add(db_coupon)

        try:
            db.session.commit()
            logger.info("Coupons seeded successfully!")
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error seeding coupons: {str(e)}")
            raise

if __name__ == '__main__':
    seed_coupons()