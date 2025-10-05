# app/routes.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os, uuid, mimetypes
from PIL import Image, UnidentifiedImageError
import pycountry

from . import db
from .models import User, Missionary, Country, Assignment, Report, ReportImage

api_bp = Blueprint('api', __name__)

# ---------- helpers ----------
def _normalize_iso2(iso2):
    return (iso2 or '').strip().upper()

def _country_name_from_iso2(iso2):
    try:
        c = pycountry.countries.get(alpha_2=iso2)
        return c.name if c else None
    except Exception:
        return None

def _ensure_country(iso2):
    iso2 = _normalize_iso2(iso2)
    if not iso2:
        return None
    c = Country.query.filter_by(iso2=iso2).first()
    if c:
        return c
    name = _country_name_from_iso2(iso2) or iso2
    c = Country(iso2=iso2, name=name, region=None, population=None, christian_percentage=None)
    db.session.add(c); db.session.commit()
    return c

# ---------- auth ----------
@api_bp.route('/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = (data.get('password') or '').strip()
    role = (data.get('role') or 'missionary').strip()
    if not email or not password:
        return jsonify({'error': 'email and password required'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'email already registered'}), 400
    u = User(email=email, role=role); u.set_password(password)
    db.session.add(u); db.session.commit()
    if role == 'missionary':
        m = Missionary(user_id=u.id, display_name=email.split('@')[0], organization='', bio='', website='')
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
    countries = Country.query.order_by(Country.name).all()
    return jsonify([{
        'id': c.id, 'iso2': c.iso2, 'name': c.name, 'region': c.region,
        'population': c.population, 'christian_percentage': c.christian_percentage
    } for c in countries])

@api_bp.route('/countries/all', methods=['GET'])
def list_all_iso_countries():
    out = []
    for c in list(pycountry.countries):
        iso2 = getattr(c, 'alpha_2', None)
        if not iso2:
            continue
        out.append({'iso2': iso2, 'name': c.name})
    out.sort(key=lambda x: x['name'])
    return jsonify(out)

@api_bp.route('/countries/<iso2>/missionaries', methods=['GET'])
def missionaries_by_country(iso2):
    c = _ensure_country(iso2)
    out = []
    for a in c.assignments:
        m = a.missionary
        # pull the linked user email
        u = m.user if hasattr(m, "user") else User.query.get(m.user_id) if getattr(m, "user_id", None) else None
        out.append({
            'id': m.id,
            'display_name': m.display_name,
            'organization': m.organization,
            'website': m.website,
            'bio': m.bio,
            'avatar_url': m.avatar_url,
            'email': u.email if u else None,   # <-- add this
        })
    return jsonify(out)

@api_bp.route('/countries/<iso2>/reports', methods=['GET'])
def reports_by_country(iso2):
    c = _ensure_country(iso2)
    reps = Report.query.filter_by(country_id=c.id).order_by(Report.created_at.desc()).limit(50).all()
    return jsonify([{
        'id': r.id, 'title': r.title, 'content': r.content,
        'created_at': r.created_at.isoformat(),
        'missionary': r.missionary.display_name,
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
    assigned_iso2 = [a.country.iso2 for a in assigned]
    return jsonify({
        'id': u.id, 'email': u.email, 'role': u.role,
        'missionary': ({
            'id': m.id, 'display_name': m.display_name, 'organization': m.organization,
            'bio': m.bio, 'website': m.website, 'avatar_url': m.avatar_url,
            'assigned_iso2': assigned_iso2
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
    upload_path = os.path.join(os.getcwd(), 'uploads'); os.makedirs(upload_path, exist_ok=True)
    f.save(os.path.join(upload_path, filename))
    url = f'/uploads/{filename}'
    u.missionary.avatar_url = url
    db.session.commit()
    return jsonify({'message':'uploaded','avatar_url':url})
@api_bp.route('/me', methods=['DELETE'])
@jwt_required()
def delete_me():
    """
    Permanently delete the current user's account (and missionary profile if present),
    including assignments, reports, report images, and uploaded files.
    """
    user_id = get_jwt_identity()
    u = User.query.get(int(user_id))
    if not u:
        return jsonify({'error': 'user_not_found'}), 404

    # Clean up missionary-owned data
    if getattr(u, 'missionary', None):
        m = u.missionary

        # Delete reports + files
        reps = Report.query.filter_by(missionary_id=m.id).all()
        for r in reps:
            # attached doc
            if r.file_url:
                try:
                    os.remove(r.file_url.lstrip('/'))
                except Exception:
                    pass
            # images
            for img in list(r.images):
                try:
                    os.remove(img.url.lstrip('/'))
                except Exception:
                    pass
                db.session.delete(img)
            db.session.delete(r)

        # Assignments
        Assignment.query.filter_by(missionary_id=m.id).delete(synchronize_session=False)

        # Avatar
        if m.avatar_url:
            try:
                os.remove(m.avatar_url.lstrip('/'))
            except Exception:
                pass

        # Delete missionary row
        db.session.delete(m)

    # Finally delete the user
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
    return jsonify([a.country.iso2 for a in assigned])

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

    # Normalize & ensure countries exist
    wanted_iso = []
    for raw in iso_list:
        iso = _normalize_iso2(raw)
        if not iso:
            continue
        c = _ensure_country(iso)
        if c:
            wanted_iso.append(iso)

    # Current assignments
    current = Assignment.query.filter_by(missionary_id=u.missionary.id).all()
    current_iso = {a.country.iso2: a for a in current}

    # Add missing
    for iso in wanted_iso:
        if iso not in current_iso:
            c = Country.query.filter_by(iso2=iso).first()
            db.session.add(Assignment(missionary_id=u.missionary.id, country_id=c.id))

    # Remove extra
    wanted_set = set(wanted_iso)
    for iso, a in current_iso.items():
        if iso not in wanted_set:
            db.session.delete(a)

    db.session.commit()
    return jsonify({'message': 'assignments_updated', 'countries': wanted_iso})

# ---------- file helpers ----------
def _save_doc(file_obj, user_id):
    allowed_mimes = {'application/pdf','text/plain','text/markdown','application/rtf'}
    mime = file_obj.mimetype or ''
    ext = (file_obj.filename.rsplit('.',1)[-1].lower() if '.' in file_obj.filename else '')
    if (mime not in allowed_mimes) and (ext not in {'pdf','txt','md','rtf'}):
        return None
    safe_name = secure_filename(file_obj.filename or f'report_{uuid.uuid4().hex}')
    save_name = f"report_{user_id}_{uuid.uuid4().hex}_{safe_name}"
    upload_path = os.path.join(os.getcwd(), 'uploads'); os.makedirs(upload_path, exist_ok=True)
    file_obj.save(os.path.join(upload_path, save_name))
    file_url = f'/uploads/{save_name}'
    if not mime:
        mime = mimetypes.guess_type(save_name)[0] or 'application/octet-stream'
    return (file_url, mime, file_obj.filename)

def _save_images(files, user_id, report_id):
    out = []
    upload_path = os.path.join(os.getcwd(), 'uploads')
    os.makedirs(upload_path, exist_ok=True)
    for f in files:
        if not f or f.filename == '':
            continue
        ext = f.filename.rsplit('.', 1)[-1].lower() if '.' in f.filename else ''
        if ext not in {'jpg','jpeg','png','gif','webp'}:
            continue
        safe = secure_filename(f.filename)
        save_name = f"reportimg_{user_id}_{uuid.uuid4().hex}_{safe}"
        file_path = os.path.join(upload_path, save_name)
        f.save(file_path)
        try:
            with Image.open(file_path) as img:
                img.verify()
            with Image.open(file_path) as img2:
                width, height = img2.size
        except (UnidentifiedImageError, OSError):
            try: os.remove(file_path)
            except Exception: pass
            continue
        url = f'/uploads/{save_name}'
        mime = mimetypes.guess_type(file_path)[0] or (f'image/{ext or "jpeg"}')
        img_row = ReportImage(report_id=report_id, url=url, mime=mime, name=f.filename, width=width, height=height)
        db.session.add(img_row); out.append(img_row)
    return out

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
        country_iso2 = _normalize_iso2(request.form.get('country_iso2'))
        title = request.form.get('title') or 'Update'
        content = request.form.get('content') or ''
        doc_file = request.files.get('file')
        image_files = request.files.getlist('images')
    else:
        data = request.get_json() or {}
        country_iso2 = _normalize_iso2(data.get('country_iso2'))
        title = data.get('title') or 'Update'
        content = data.get('content') or ''
        doc_file = None
        image_files = []

    # ENFORCE: only allowed to report for assigned countries
    assigned_iso = [a.country.iso2 for a in Assignment.query.filter_by(missionary_id=u.missionary.id).all()]
    if country_iso2 not in assigned_iso:
        return jsonify({'error': 'not_assigned_to_country'}), 403

    c = _ensure_country(country_iso2)
    if not c:
        return jsonify({'error': 'unknown country'}), 400

    file_url = file_mime = file_name = None
    if doc_file:
        saved = _save_doc(doc_file, u.id)
        if not saved:
            return jsonify({'error': 'unsupported file type'}), 400
        file_url, file_mime, file_name = saved

    r = Report(missionary_id=u.missionary.id, country_id=c.id,
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
        try: os.remove(r.file_url.lstrip('/'))
        except Exception: pass
    for img in r.images:
        try: os.remove(img.url.lstrip('/'))
        except Exception: pass
    db.session.delete(r); db.session.commit()
    return jsonify({'message':'deleted'})
