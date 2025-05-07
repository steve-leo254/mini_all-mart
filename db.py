from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import Column, Integer, ForeignKey, String, Numeric, DateTime
from sqlalchemy.orm import relationship
from flask_login import UserMixin

# Initialize SQLAlchemy (without app)
db = SQLAlchemy()


class Products(db.Model):
    __tablename__ = 'products'
    product_id = db.Column(db.Integer, primary_key=True)
    product_name = db.Column(db.String(255), nullable=False)
    buying_price = db.Column(db.Numeric(precision=15, scale=2), nullable=False)
    selling_price = db.Column(db.Numeric(
        precision=15, scale=2), nullable=False)
    stock_quantity = db.Column(db.Numeric(
        precision=15, scale=2), nullable=False)
    image = db.Column(db.String(255))  # We'll address this column next
    category = db.Column(db.String(50))
    sales_details = relationship("SaleDetails", back_populates="product")


class Users(db.Model, UserMixin):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), nullable=False, unique=True)
    password = db.Column(db.String(255), nullable=False)


class SaleDetails(db.Model):
    __tablename__ = 'sale_details'
    id = db.Column(db.Integer, primary_key=True)
    sale_id = db.Column(db.Integer, db.ForeignKey(
        'sales.sale_id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey(
        'products.product_id'), nullable=False)
    quantity = db.Column(db.Numeric(precision=15, scale=2), nullable=False)
    purchase_amount = db.Column(db.Numeric(
        precision=15, scale=2), nullable=False)
    product = relationship("Products", back_populates="sales_details")
    sales = relationship("Sales", back_populates="sale_details")


class Sales(db.Model):
    __tablename__ = 'sales'
    sale_id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey(
        'customers.customer_id'), nullable=False)
    total_amount = db.Column(db.Numeric(precision=15, scale=2), nullable=False)
    created_at = db.Column(DateTime, default=db.func.current_timestamp())
    sale_details = relationship("SaleDetails", back_populates="sales")
    customer = relationship("Customers", back_populates="sales")


class Customers(db.Model):
    __tablename__ = 'customers'
    customer_id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(255), nullable=False)
    phone_no = db.Column(db.String(13), nullable=False)
    email = db.Column(db.String(255), unique=True)
    sales = relationship("Sales", back_populates="customer")
    payments = relationship("Payments", back_populates="customer")


class Employees(db.Model):
    __tablename__ = 'employees'
    employee_id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), unique=True)
    contact = db.Column(db.String(13), nullable=False)
    position = db.Column(db.String(255), nullable=False)


class Payments(db.Model):
    __tablename__ = 'payments'
    id = db.Column(db.Integer, primary_key=True)
    sale_id = db.Column(db.Integer, db.ForeignKey(
        'sales.sale_id'), nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey(
        'customers.customer_id'), nullable=False)
    payment_method = db.Column(db.String(255), nullable=False)
    amount = db.Column(db.Numeric(precision=15, scale=2), nullable=False)
    customer = relationship("Customers", back_populates="payments")
    sale = relationship("Sales")


class Stock(db.Model):
    __tablename__ = 'stock'
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(JSONB)
