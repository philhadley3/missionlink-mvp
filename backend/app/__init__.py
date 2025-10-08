__version__ = "1.0.0"
# app/__init__.py
from flask import Flask, send_from_directory, jsonify, make_response
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from werkzeug.middleware.proxy_fix import ProxyFix
import os
import re
import traceback

db = SQLAlchemy()
jwt = JWTManager()

def create_app():
    app = Flask(__name__)

    # Trust reverse proxy headers (X-Forwarded-Proto/Host) for correct URL scheme in prod
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

    # --- Core config ----------------------------------------------------------
    flask_env = os.getenv("FLASK_ENV", "development")

    secret = os.getenv("FLASK_SECRET_KEY")
    if not secret and flask_env == "production":
        raise RuntimeError("FLASK_SECRET_KEY is required in production")
    app.config["SECRET_KEY"] = secret or "dev-only-change-me"

    jwt_secret = os.getenv("JWT_SECRET_KEY") or os.getenv("JWT_SECRET")
    if not jwt_secret and flask_env == "production":
        raise RuntimeError("JWT secret is required in production (set JWT_SECRET_KEY or JWT_SECRET)")
    app.config["JWT_SECRET_KEY"] = jwt_secret or "dev-only-change-me"

    # Database
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///missionlink.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # --- CORS for frontend (dev + prod) --------------------------------------
    # Base allowlist
    cors_origins = {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://missionlink.anchorsforlife.org",
    }
    # Allow all Vercel preview domains (e.g. https://yourapp.vercel.app)
    cors_regexes = [re.compile(r"^https://.*\.vercel\.app$")]

    # Optional env override: CORS_ORIGINS="https://foo.com,https://bar.com"
    extra = os.getenv("CORS_ORIGINS", "").strip()
    if extra:
        for origin in [o.strip() for o in extra.split(",") if o.strip()]:
            cors_origins.add(origin)

    CORS(
        app,
        resources={r"/api/*": {"origins": list(cors_origins) + cors_regexes}},
        supports_credentials=True,  # safe even if you use header-based JWT
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    # --- Init extensions ------------------------------------------------------
    db.init_app(app)
    jwt.init_app(app)

    # Import models so db.create_all() sees them
    from .models import User, Missionary, Country, Assignment, Report  # noqa

    with app.app_context():
        db.create_all()

    # --- Static uploads (configurable/persistent) -----------------------------
    DEFAULT_UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'uploads'))
    upload_dir = os.path.abspath(os.getenv('UPLOAD_DIR', DEFAULT_UPLOAD_DIR))
    os.makedirs(upload_dir, exist_ok=True)
    app.config["UPLOAD_FOLDER"] = upload_dir

    # Serve files under /api/files/<filename> with GET/HEAD/OPTIONS
    @app.route('/api/files/<path:filename>', methods=["GET", "HEAD", "OPTIONS"])
    def api_files(filename):
        return send_from_directory(upload_dir, filename, as_attachment=False)

    # Legacy path for anything still linking to /uploads/...
    @app.route('/uploads/<path:filename>', methods=["GET", "HEAD", "OPTIONS"])
    def uploads(filename):
        return send_from_directory(upload_dir, filename, as_attachment=False)

    # --- Health & preflight ---------------------------------------------------
    @app.get("/healthz")
    def healthz():
        return {"status": "ok"}, 200

    @app.get("/api/health")
    def api_health():
        return {"status": "ok"}, 200

    @app.route("/api/<path:subpath>", methods=["OPTIONS"])
    def api_options(subpath):
        return make_response("", 204)

    @app.route("/api/ping")
    def ping():
        return {"ok": True}

    # --- Security headers -----------------------------------------------------
    @app.after_request
    def _security_headers(resp):
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        resp.headers["X-Frame-Options"] = "DENY"
        if flask_env == "production":
            resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        return resp

    # --- JWT error handlers ---------------------------------------------------
    @jwt.unauthorized_loader
    def _unauth(msg):
        return jsonify({"error": "unauthorized", "message": msg}), 401

    @jwt.invalid_token_loader
    def _invalid(msg):
        return jsonify({"error": "invalid_token", "message": msg}), 401

    @jwt.expired_token_loader
    def _expired(jwt_header, jwt_payload):
        return jsonify({"error": "token_expired"}), 401

    # --- Global error handler -------------------------------------------------
    @app.errorhandler(Exception)
    def _handle_exc(e):
        traceback.print_exc()
        code = getattr(e, "code", 500)
        return jsonify({"error": "server_error", "message": str(e)}), code

    # --- API routes -----------------------------------------------------------
    from .routes import api_bp
    app.register_blueprint(api_bp, url_prefix='/api')

    return app
