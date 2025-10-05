
# MissionLink — Backend (Flask)

## Run
```bash
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python seed.py            # populate countries + sample missionary
python run.py             # http://localhost:5001/api
```

## Auth
- Register (missionary): `POST /api/auth/register {"email":"you@example.com","password":"...","role":"missionary"}`
- Login: `POST /api/auth/login {"email":"you@example.com","password":"..."}` → `access_token` (JWT)
- Me: `GET /api/me` (Authorization: Bearer TOKEN)

## Missionary actions
- Update profile: `PUT /api/me/profile` (Authorization header)
- Create report: `POST /api/me/reports {"country_iso2":"KE","title":"...","content":"..."}` (Authorization header)

## Public endpoints
- `GET /api/countries`
- `GET /api/countries/:ISO2/missionaries`
- `GET /api/countries/:ISO2/reports`
