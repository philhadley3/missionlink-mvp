
from app import create_app, db
from app.models import Country, User, Missionary, Assignment, Report
from datetime import datetime

app = create_app()
with app.app_context():
    if not Country.query.first():
        countries = [
            {'iso2': 'KE', 'name': 'Kenya', 'region': 'Africa', 'population': 53771300, 'christian_percentage': 85.5},
            {'iso2': 'BR', 'name': 'Brazil', 'region': 'South America', 'population': 212559000, 'christian_percentage': 87.0},
            {'iso2': 'IN', 'name': 'India', 'region': 'Asia', 'population': 1380004385, 'christian_percentage': 2.3},
        ]
        for c in countries:
            db.session.add(Country(**c))
        db.session.commit()

    if not User.query.filter_by(email='anna@mission.org').first():
        u = User(email='anna@mission.org', role='missionary')
        u.set_password('password123')
        db.session.add(u); db.session.commit()
        m = Missionary(user_id=u.id, display_name='Anna M.', organization='Hope International', bio='Serving in Nairobi.', website='https://example.org/anna')
        db.session.add(m); db.session.commit()

        ke = Country.query.filter_by(iso2='KE').first()
        db.session.add(Assignment(missionary_id=m.id, country_id=ke.id))
        db.session.add(Report(missionary_id=m.id, country_id=ke.id, title='Community outreach', content='We held a health clinic week with local partners.'))
        db.session.commit()

    print('Seed complete. Users: anna@mission.org / password123')
