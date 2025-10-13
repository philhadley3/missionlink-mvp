# app/routes.py
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os, uuid, mimetypes
from PIL import Image, UnidentifiedImageError
import pycountry

from . import db
from .models import User, Missionary, Assignment, Report, ReportImage
from .country import Country

api_bp = Blueprint('api', __name__)

# ---------- helpers ----------
def _normalize_iso2(iso2):
    return (iso2 or '').strip().upper()

def _country_name_from_alpha2(alpha2):
    try:
        c = pycountry.countries.get(alpha_2=alpha2)
        return c.name if c else None
    except Exception:
        return None

def _flag_from_alpha2(alpha2: str) -> str:
    try:
        return ''.join(chr(0x1F1E6 + (ord(c) - ord('A'))) for c in alpha2.upper())
    except Exception:
        return None

def _ensure_country(alpha2: str):
    """Return Country row for alpha2; create minimally from pycountry if not present."""
    alpha2 = _normalize_iso2(alpha2)
    if not alpha2:
        return None

    row = Country.query.filter_by(alpha2=alpha2).first()
    if row:
        return row

    # Best-effort create from pycountry (should be rare since we seed 249 rows)
    pc = pycountry.countries.get(alpha_2=alpha2)
    if not pc:
        # fallback minimal
        name = alpha2
        row = Country(name=name, official_name=None, alpha2=alpha2,
                      alpha3=None, numeric=None, flag_emoji=_flag_from_alpha2(alpha2))
        db.session.add(row); db.session.commit()
        return row

    name = pc.name
    off = getattr(pc, "official_name", None)
    a3 = getattr(pc, "alpha_3", None)
    num = getattr(pc, "numeric", None)
    row = Country(
        name=name,
        official_name=off,
        alpha2=alpha2,
        alpha3=a3,
        numeric=num,
        flag_emoji=_flag_from_alpha2(alpha2),
    )
    db.session.add(row); db.session.commit()
    return row

# ---------- auth ----------
@api_bp.route('/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}

    # --- Access code enforcement --------------------------------------------
    supplied_code = (data.get('access_code') or '').strip()
    required_code = (current_app.config.get('ACCESS_CODE') or '').strip()

    if not required_code:
        return jsonify({'error': 'signup_unavailable', 'message': 'access code not configured'}), 503
    if not supplied_code:
        return jsonify({'error': 'access_code required'}), 400
    if supplied_code != required_code:
        return jsonify({'error': 'invalid access code'}), 403

    # --- Normal registration flow -------------------------------------------
    email = (data.get('email') or '').strip().lower()
    password = (data.get('password') or '').strip()
    role = (data.get('role') or 'missionary').strip()

    if not email or not password:
        return jsonify({'error': 'email and password required'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'email already registered'}), 400

    u = User(email=email, role=role)
    u.set_password(password)
    db.session.add(u); db.session.commit()

    if role == 'missionary':
        m = Missionary(
            user_id=u.id,
            display_name=email.split('@')[0],
            organization='',
            bio='',
            website=''
        )
        db.session.add(m); db.session.commit()

    return jsonify({'message': 'registered'}), 201

@api_bp.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = (data.get('password') or '').strip()
    u = User.query.filter_by(email=email).first()
    if not u or not u.check_password(password):
        return jsonify({'error': 'invalid credentials'}), 401
    token = create_access_token(identity=str(u.id), additional_claims={'role': u.role})
    return jsonify({'access_token': token, 'role': u.role})

# ---------- countries ----------
@api_bp.route('/countries', methods=['GET'])
def list_countries():
    rows = Country.query.order_by(Country.name).all()
    out = []
    for c in rows:
        # Prefer model serializer
        d = c.to_dict() if hasattr(c, "to_dict") else {
            "id": getattr(c, "id", None),
            "name": getattr(c, "name", None),
            "official_name": getattr(c, "official_name", None),
            "alpha2": getattr(c, "alpha2", None),
            "alpha3": getattr(c, "alpha3", None),
            "numeric": getattr(c, "numeric", None),
            "flag_emoji": getattr(c, "flag_emoji", None),
        }
        # Frontend compatibility aliases (don’t overwrite if already present)
        d.setdefault("iso2", d.get("alpha2"))
        d.setdefault("iso3", d.get("alpha3"))
        d.setdefault("flag", d.get("flag_emoji"))
        out.append(d)
    return jsonify(out)

@api_bp.route('/countries/all', methods=['GET'])
def list_all_iso_countries():
    out = []
    for c in list(pycountry.countries):
        alpha2 = getattr(c, 'alpha_2', None)
        if not alpha2:
            continue
        out.append({'alpha2': alpha2, 'name': c.name})
    out.sort(key=lambda x: x['name'])
    return jsonify(out)

@api_bp.route('/countries/<alpha2>/missionaries', methods=['GET'])
def missionaries_by_country(alpha2):
    alpha2 = _normalize_iso2(alpha2)
    c = _ensure_country(alpha2)
    if not c:
        return jsonify([])

    assigns = Assignment.query.filter_by(country_alpha2=alpha2).all()
    out = []
    for a in assigns:
        m = a.missionary
        if not m:
            continue
        u = m.user if hasattr(m, "user") else User.query.get(m.user_id) if getattr(m, "user_id", None) else None
        out.append({
            'id': m.id,
            'display_name': m.display_name,
            'organization': m.organization,
            'website': m.website,
            'bio': m.bio,
            'avatar_url': m.avatar_url,
            'email': u.email if u else None,
        })
    return jsonify(out)

@api_bp.route('/countries/<alpha2>/reports', methods=['GET'])
def reports_by_country(alpha2):
    alpha2 = _normalize_iso2(alpha2)
    c = _ensure_country(alpha2)
    if not c:
        return jsonify([])

    assigns = Assignment.query.filter_by(country_alpha2=alpha2).all()
    missionary_ids = [a.missionary_id for a in assigns if a.missionary_id]
    if not missionary_ids:
        return jsonify([])

    reps = Report.query.filter(Report.missionary_id.in_(missionary_ids)) \
                       .order_by(Report.created_at.desc()) \
                       .limit(50).all()
    return jsonify([{
        'id': r.id, 'title': r.title, 'content': r.content,
        'created_at': r.created_at.isoformat(),
        'missionary': (r.missionary.display_name if r.missionary else None),
        'file_url': r.file_url, 'file_name': r.file_name, 'file_mime': r.file_mime,
        'images': [{'id': img.id, 'url': img.url, 'mime': img.mime, 'name': img.name, 'width': img.width, 'height': img.height}
                   for img in r.images]
    } for r in reps])

# ---------- me ----------
@api_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    if not user_id: return jsonify({'error':'unauthorized'}), 401
    u = User.query.get(int(user_id))
    if not u: return jsonify({'error':'user not found'}), 401
    m = u.missionary
    assigned = Assignment.query.filter_by(missionary_id=m.id).all() if m else []
    assigned_alpha2 = [a.country_alpha2 for a in assigned]
    return jsonify({
        'id': u.id, 'email': u.email, 'role': u.role,
        'missionary': ({
            'id': m.id, 'display_name': m.display_name, 'organization': m.organization,
            'bio': m.bio, 'website': m.website, 'avatar_url': m.avatar_url,
            'assigned_alpha2': assigned_alpha2
        } if m else None)
    })

@api_bp.route('/me/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    u = User.query.get(int(user_id))
    if not u or not u.missionary:
        return jsonify({'error':'only missionaries can update profile'}), 403
    data = request.get_json() or {}
    m = u.missionary
    m.display_name = data.get('display_name', m.display_name)
    m.organization = data.get('organization', m.organization)
    m.bio = data.get('bio', m.bio)
    m.website = data.get('website', m.website)
    db.session.commit()
    return jsonify({'message':'updated'})

@api_bp.route('/me/avatar', methods=['POST'])
@jwt_required()
def upload_avatar():
    user_id = get_jwt_identity()
    u = User.query.get(int(user_id))
    if not u or not u.missionary: return jsonify({'error':'only missionaries can upload avatars'}), 403
    if 'file' not in request.files: return jsonify({'error':'no file uploaded'}), 400
    f = request.files['file']
    if f.filename == '': return jsonify({'error':'empty filename'}), 400
    allowed_ext = {'png','jpg','jpeg','gif','webp'}
    ext = f.filename.rsplit('.',1)[-1].lower() if '.' in f.filename else ''
    if ext not in allowed_ext: return jsonify({'error':'unsupported file type'}), 400

    filename = secure_filename(f'{u.id}_avatar.{ext}')
    upload_path = current_app.config.get("UPLOAD_FOLDER")
    os.makedirs(upload_path, exist_ok=True)
    f.save(os.path.join(upload_path, filename))
    url = f'/api/files/{filename}'

    u.missionary.avatar_url = url
    db.session.commit()
    return jsonify({'message':'uploaded','avatar_url':url})

@api_bp.route('/me', methods=['DELETE'])
@jwt_required()
def delete_me():
    """
    Permanently delete the current user's account, missionary profile,
    assignments, reports, report images, and uploaded files.
    """
    user_id = get_jwt_identity()
    u = User.query.get(int(user_id))
    if not u:
        return jsonify({'error': 'user_not_found'}), 404

    if getattr(u, 'missionary', None):
        m = u.missionary

        # Delete reports + files
        reps = Report.query.filter_by(missionary_id=m.id).all()
        for r in reps:
            if r.file_url:
                try:
                    p = _fs_path_from_url(r.file_url)
                    if p and os.path.isfile(p):
                        os.remove(p)
                except Exception:
                    pass
            for img in list(r.images):
                try:
                    p = _fs_path_from_url(img.url)
                    if p and os.path.isfile(p):
                        os.remove(p)
                except Exception:
                    pass
                db.session.delete(img)
            db.session.delete(r)

        # Assignments
        Assignment.query.filter_by(missionary_id=m.id).delete(synchronize_session=False)

        # Avatar
        if m.avatar_url:
            try:
                p = _fs_path_from_url(m.avatar_url)
                if p and os.path.isfile(p):
                    os.remove(p)
            except Exception:
                pass

        db.session.delete(m)

    db.session.delete(u)
    db.session.commit()
    return jsonify({'message': 'account_deleted'})

# ----- multiple assignments -----
@api_bp.route('/me/assignments', methods=['GET'])
@jwt_required()
def get_assignments():
    user_id = get_jwt_identity()
    u = User.query.get(int(user_id))
    if not u or not u.missionary: return jsonify([])
    assigned = Assignment.query.filter_by(missionary_id=u.missionary.id).all()
    return jsonify([a.country_alpha2 for a in assigned])

@api_bp.route('/me/assignments', methods=['PUT'])
@jwt_required()
def set_assignments():
    """
    Replace the missionary's assignment list with the provided ISO2 array.
    Body: { "countries": ["KE","IN","BR"] }
    """
    user_id = get_jwt_identity()
    u = User.query.get(int(user_id))
    if not u or not u.missionary:
        return jsonify({'error':'only missionaries can set assignments'}), 403
    data = request.get_json() or {}
    iso_list = data.get('countries')
    if not isinstance(iso_list, list):
        return jsonify({'error':'countries must be an array of ISO2 codes'}), 400

    wanted_alpha2 = []
    for raw in iso_list:
        alpha2 = _normalize_iso2(raw)
        if not alpha2:
            continue
        c = _ensure_country(alpha2)
        if c:
            wanted_alpha2.append(alpha2)

    current = Assignment.query.filter_by(missionary_id=u.missionary.id).all()
    current_by_alpha2 = {a.country_alpha2: a for a in current if a.country_alpha2}

    for alpha2 in wanted_alpha2:
        if alpha2 not in current_by_alpha2:
            db.session.add(Assignment(missionary_id=u.missionary.id, country_alpha2=alpha2))

    wanted_set = set(wanted_alpha2)
    for alpha2, a in current_by_alpha2.items():
        if alpha2 not in wanted_set:
            db.session.delete(a)

    db.session.commit()
    return jsonify({'message': 'assignments_updated', 'countries': wanted_alpha2})

# ---------- file helpers (mounted disk + /api/files URLs) ----------
def _upload_dir() -> str:
    return current_app.config.get("UPLOAD_FOLDER")

def _public_url(filename: str) -> str:
    return f"/api/files/{filename}"

def _fs_path_from_url(url: str) -> str | None:
    """
    Map a stored URL back to the filesystem path inside UPLOAD_FOLDER.
    Supports new-style /api/files/<name> and legacy /uploads/<name>.
    """
    if not url:
        return None
    base = _upload_dir()
    if not base:
        return None

    token = "/api/files/"
    if token in url:
        name = url.split(token, 1)[1]
    else:
        if "/uploads/" in url:
            name = url.split("/uploads/", 1)[1]
        else:
            name = url.lstrip("/")

    if not name:
        return None
    return os.path.join(base, name)

# ---------- reports ----------
@api_bp.route('/me/reports', methods=['POST'])
@jwt_required()
def create_report():
    user_id = get_jwt_identity()
    u = User.query.get(int(user_id))
    if not u or not u.missionary:
        return jsonify({'error':'only missionaries can post reports'}), 403

    is_multipart = request.content_type and 'multipart/form-data' in request.content_type
    if is_multipart:
        country_alpha2 = _normalize_iso2(request.form.get('country_iso2'))
        title = request.form.get('title') or 'Update'
        content = request.form.get('content') or ''
        doc_file = request.files.get('file')
        image_files = request.files.getlist('images')
    else:
        data = request.get_json() or {}
        country_alpha2 = _normalize_iso2(data.get('country_iso2'))
        title = data.get('title') or 'Update'
        content = data.get('content') or ''
        doc_file = None
        image_files = []

    assigned_alpha2 = [a.country_alpha2 for a in Assignment.query.filter_by(missionary_id=u.missionary.id).all()]
    if country_alpha2 not in assigned_alpha2:
        return jsonify({'error': 'not_assigned_to_country'}), 403

    c = _ensure_country(country_alpha2)
    if not c:
        return jsonify({'error': 'unknown country'}), 400

    file_url = file_mime = file_name = None
    if doc_file:
        saved = _save_doc(doc_file, u.id)
        if not saved:
            return jsonify({'error': 'unsupported file type'}), 400
        file_url, file_mime, file_name = saved

    r = Report(missionary_id=u.missionary.id,
               title=title, content=content,
               file_url=file_url, file_mime=file_mime, file_name=file_name)
    db.session.add(r); db.session.commit()

    if image_files:
        _ = _save_images(image_files, u.id, r.id)
        db.session.commit()

    return jsonify({'message':'report created','id': r.id}), 201

@api_bp.route('/me/reports', methods=['GET'])
@jwt_required()
def my_reports():
    user_id = get_jwt_identity()
    u = User.query.get(int(user_id))
    if not u or not u.missionary:
        return jsonify([])
    reps = Report.query.filter_by(missionary_id=u.missionary.id).order_by(Report.created_at.desc()).all()
    return jsonify([{
        'id': r.id, 'title': r.title, 'content': r.content,
        'created_at': r.created_at.isoformat(),
        'file_url': r.file_url, 'file_name': r.file_name, 'file_mime': r.file_mime,
        'images': [{'id': img.id, 'url': img.url, 'mime': img.mime, 'name': img.name, 'width': img.width, 'height': img.height}
                   for img in r.images]
    } for r in reps])

@api_bp.route('/me/reports/<int:rid>', methods=['DELETE'])
@jwt_required()
def delete_my_report(rid):
    user_id = get_jwt_identity()
    u = User.query.get(int(user_id))
    if not u or not u.missionary:
        return jsonify({'error':'forbidden'}), 403
    r = Report.query.get_or_404(rid)
    if r.missionary_id != u.missionary.id:
        return jsonify({'error':'forbidden'}), 403

    if r.file_url:
        try:
            p = _fs_path_from_url(r.file_url)
            if p and os.path.isfile(p):
                os.remove(p)
        except Exception:
            pass

    for img in r.images:
        try:
            p = _fs_path_from_url(img.url)
            if p and os.path.isfile(p):
                os.remove(p)
        except Exception:
            pass

    db.session.delete(r); db.session.commit()
    return jsonify({'message':'deleted'})
