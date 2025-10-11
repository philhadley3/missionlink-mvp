# app/models.py
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from . import db

# ---------------------------
# User & Auth
# ---------------------------
class User(db.Model):
    # __tablename__ defaults to "user"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), default="supporter")  # 'missionary', 'admin', 'supporter'

    # 1:1 user -> missionary (optional; a user may or may not be a missionary)
    missionary = db.relationship("Missionary", backref="user", uselist=False, cascade="all, delete-orphan")

    # Password helpers
    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)


# ---------------------------
# Missionaries & Assignments
# ---------------------------
class Missionary(db.Model):
    # __tablename__ defaults to "missionary"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)

    # Core profile
    first_name = db.Column(db.String(120))
    last_name  = db.Column(db.String(120))
    display_name = db.Column(db.String(120))          # optional public-facing name
    email = db.Column(db.String(255))
    phone = db.Column(db.String(50))
    organization = db.Column(db.String(120))
    bio = db.Column(db.Text)
    website = db.Column(db.String(255))
    avatar_url = db.Column(db.String(255))            # e.g., /uploads/1_avatar.jpg

    # Optional "home/base" country by alpha2 (not required)
    country_alpha2 = db.Column(db.String(2), index=True)

    # Relationships
    assignments = db.relationship("Assignment", backref="missionary", cascade="all, delete-orphan")
    reports     = db.relationship("Report", backref="missionary", cascade="all, delete-orphan")


class Assignment(db.Model):
    # __tablename__ defaults to "assignment"
    id = db.Column(db.Integer, primary_key=True)
    missionary_id = db.Column(db.Integer, db.ForeignKey("missionary.id"), nullable=False)

    # Link to ISO country via alpha-2 code (FK to countries.alpha2)
    country_alpha2 = db.Column(
        db.String(2),
        db.ForeignKey("countries.alpha2"),   # <-- references Country.alpha2 in app/country.py
        index=True,
        nullable=False,
    )

    role = db.Column(db.String(120))        # e.g., "Church Planter", "Translator", etc.
    start_date = db.Column(db.Date)
    end_date   = db.Column(db.Date)
    notes = db.Column(db.Text)


# ---------------------------
# Reports & Images
# ---------------------------
class Report(db.Model):
    # __tablename__ defaults to "report"
    id = db.Column(db.Integer, primary_key=True)
    missionary_id = db.Column(db.Integer, db.ForeignKey("missionary.id"), nullable=True)

    title = db.Column(db.String(255))
    content = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    # Optional attachment fields
    file_url  = db.Column(db.String(255))
    file_name = db.Column(db.String(255))
    file_mime = db.Column(db.String(100))

    images = db.relationship("ReportImage", backref="report", cascade="all, delete-orphan")


class ReportImage(db.Model):
    # __tablename__ defaults to "report_image"
    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, db.ForeignKey("report.id"), nullable=False)

    url  = db.Column(db.String(255), nullable=False)  # e.g., /uploads/reportimg_<...>.jpg
    mime = db.Column(db.String(100))                  # image/jpeg, image/png, ...
    name = db.Column(db.String(255))                  # original filename
    width  = db.Column(db.Integer)
    height = db.Column(db.Integer)
