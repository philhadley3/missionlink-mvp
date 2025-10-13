from uuid import uuid4
from app import db

class Country(db.Model):
    __tablename__ = "countries"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    name = db.Column(db.String(128), nullable=False)              # Common name
    official_name = db.Column(db.String(256), nullable=True)      # ISO official name (optional)
    alpha2 = db.Column(db.String(2), nullable=False, unique=True, index=True)
    alpha3 = db.Column(db.String(3), nullable=False, unique=True, index=True)
    numeric = db.Column(db.String(3), nullable=False, index=True) # Keep as string (leading zeros)
    flag_emoji = db.Column(db.String(8), nullable=True)

    def to_dict(self):
        return {
            "name": self.name,
            "official_name": self.official_name,
            "alpha2": self.alpha2,
            "alpha3": self.alpha3,
            "numeric": self.numeric,
            "flag": self.flag_emoji,
        }
