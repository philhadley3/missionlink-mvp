__version__ = "1.0.0"
# app/__init__.py
from flask import Flask, send_from_directory, jsonify, make_response
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_jwt_extended import JWTManager
import os
import traceback

db = SQLAlchemy()
jwt = JWTManager()

def create_app():
    app = Flask(__name__)


    # --- Core config ----------------------------------------------------------
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///missionlink.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-secret-change-me')

    # --- CORS for frontend at Vite (5173) ------------------------------------
    # Allow your React dev server origins; credentials allowed for JWT/cookies.
    FRONTEND_ORIGINS = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    CORS(
        app,
        resources={r"/api/*": {"origins": FRONTEND_ORIGINS}},
        supports_credentials=True,
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

    # --- Static uploads (configurable/persistent) ------------------------------
    # Default to ../uploads next to this app package; allow override via UPLOAD_DIR
    DEFAULT_UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'uploads'))
    upload_dir = os.path.abspath(os.getenv('UPLOAD_DIR', DEFAULT_UPLOAD_DIR))
    os.makedirs(upload_dir, exist_ok=True)

    @app.route('/uploads/<path:filename>')
    def uploads(filename):
        return send_from_directory(upload_dir, filename)

    # Some clients preflight to /api/* with OPTIONS
    @app.route("/api/<path:subpath>", methods=["OPTIONS"])
    def api_options(subpath):
        return make_response("", 204)

    # Simple health check
    @app.route("/api/ping")
    def ping():
        return {"ok": True}

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
    # All your application routes live under /api
    app.register_blueprint(api_bp, url_prefix='/api')

    return app
