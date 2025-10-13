# app/cli.py
import click
import pycountry
from flask.cli import with_appcontext
from app import db
from app.country import Country

def _flag_from_alpha2(alpha2: str) -> str:
    # Regional indicator letters 🇦 (U+1F1E6) … 🇿
    return "".join(chr(0x1F1E6 + (ord(c) - ord('A'))) for c in alpha2.upper())

@click.command("sync-countries")
@with_appcontext
def sync_countries():
    """Sync ISO-3166-1 countries into the DB (idempotent)."""
    created = 0
    updated = 0

    for c in pycountry.countries:  # current (non-historic) list
        alpha2 = getattr(c, "alpha_2", None)
        alpha3 = getattr(c, "alpha_3", None)
        numeric = getattr(c, "numeric", None)
        name = getattr(c, "name", None)
        official_name = getattr(c, "official_name", None)

        if not (alpha2 and alpha3 and numeric and name):
            continue

        row = Country.query.filter_by(alpha2=alpha2).first()
        if row:
            changed = False
            if row.name != name: row.name, changed = name, True
            if row.official_name != official_name: row.official_name, changed = official_name, True
            if row.alpha3 != alpha3: row.alpha3, changed = alpha3, True
            if row.numeric != numeric: row.numeric, changed = numeric, True
            flag = _flag_from_alpha2(alpha2)
            if row.flag_emoji != flag: row.flag_emoji, changed = flag, True
            if changed:
                updated += 1
        else:
            db.session.add(Country(
                name=name,
                official_name=official_name,
                alpha2=alpha2,
                alpha3=alpha3,
                numeric=numeric,
                flag_emoji=_flag_from_alpha2(alpha2),
            ))
            created += 1

    db.session.commit()
    click.echo(f"Countries sync complete. Created: {created}, Updated: {updated}")
