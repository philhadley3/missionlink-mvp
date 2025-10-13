# app/country.py
from uuid import uuid4
from . import db  # use relative import to work inside the app package

class Country(db.Model):
    __tablename__ = "countries"

    # Use string UUIDs if that's how your migration created the table
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    name = db.Column(db.String(128), nullable=False)              # Common name
    official_name = db.Column(db.String(256), nullable=True)      # ISO official name (optional)
    alpha2 = db.Column(db.String(2),  nullable=False, unique=True, index=True)
    alpha3 = db.Column(db.String(3),  nullable=False, unique=True, index=True)
    numeric = db.Column(db.String(3), nullable=False, index=True) # Keep as string (leading zeros)
    flag_emoji = db.Column(db.String(8), nullable=True)

    def to_dict(self):
        """
        Canonical keys AND frontend-compatibility aliases so the UI
        continues to work without changes.
        """
        return {
            # canonical
            "id": self.id,
            "name": self.name,
            "official_name": self.official_name,
            "alpha2": self.alpha2,
            "alpha3": self.alpha3,
            "numeric": self.numeric,
            "flag_emoji": self.flag_emoji,
            # aliases expected by the existing frontend
            "iso2": self.alpha2,
            "iso3": self.alpha3,
            "flag": self.flag_emoji,
        }
