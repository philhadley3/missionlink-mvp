from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from . import db

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), default='supporter')  # 'missionary', 'admin', 'supporter'
    missionary = db.relationship('Missionary', backref='user', uselist=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Country(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    iso2 = db.Column(db.String(2), unique=True, nullable=False)
    name = db.Column(db.String(120), nullable=False)
    region = db.Column(db.String(120))
    population = db.Column(db.Integer)
    christian_percentage = db.Column(db.Float)

    assignments = db.relationship('Assignment', backref='country', cascade='all, delete-orphan')
    reports = db.relationship('Report', backref='country', cascade='all, delete-orphan')

class Missionary(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    display_name = db.Column(db.String(120), nullable=False)
    organization = db.Column(db.String(120))
    bio = db.Column(db.Text)
    website = db.Column(db.String(255))
    avatar_url = db.Column(db.String(255))  # /uploads/1_avatar.jpg

    assignments = db.relationship('Assignment', backref='missionary', cascade='all, delete-orphan')
    reports = db.relationship('Report', backref='missionary', cascade='all, delete-orphan')

class Assignment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    missionary_id = db.Column(db.Integer, db.ForeignKey('missionary.id'), nullable=False)
    country_id = db.Column(db.Integer, db.ForeignKey('country.id'), nullable=False)
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)

class Report(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    missionary_id = db.Column(db.Integer, db.ForeignKey('missionary.id'), nullable=False)
    country_id = db.Column(db.Integer, db.ForeignKey('country.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # optional document attachment
    file_url = db.Column(db.String(255))
    file_name = db.Column(db.String(255))
    file_mime = db.Column(db.String(100))

    images = db.relationship('ReportImage', backref='report', cascade='all, delete-orphan')

class ReportImage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, db.ForeignKey('report.id'), nullable=False)
    url = db.Column(db.String(255), nullable=False)   # /uploads/reportimg_<...>.jpg
    mime = db.Column(db.String(100))                  # image/jpeg, image/png, ...
    name = db.Column(db.String(255))                  # original filename
    width = db.Column(db.Integer)                     # optional
    height = db.Column(db.Integer)                    # optional
