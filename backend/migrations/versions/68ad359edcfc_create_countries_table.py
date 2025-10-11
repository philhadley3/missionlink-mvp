"""create countries table (no-batch, sqlite-safe)"""

from alembic import op
import sqlalchemy as sa

# --- Alembic identifiers ---
revision = "68ad359edcfc"     # keep the same as the filename
down_revision = None          # set to prior revision id if you actually have one
branch_labels = None
depends_on = None

# --------- Helpers ---------
def table_exists(bind, name: str) -> bool:
    insp = sa.inspect(bind)
    return name in insp.get_table_names()

def column_exists(bind, table: str, column: str) -> bool:
    insp = sa.inspect(bind)
    if table not in insp.get_table_names():
        return False
    return any(c["name"] == column for c in insp.get_columns(table))

def index_exists(bind, table: str, index_name: str) -> bool:
    insp = sa.inspect(bind)
    try:
        idx = insp.get_indexes(table)
    except Exception:
        return False
    return any(i["name"] == index_name for i in idx)

# ------------------------------ UPGRADE ------------------------------
def upgrade():
    bind = op.get_bind()

    # 1) countries table
    if not table_exists(bind, "countries"):
        op.create_table(
            "countries",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("name", sa.String(length=128), nullable=False),
            sa.Column("official_name", sa.String(length=256), nullable=True),
            sa.Column("alpha2", sa.String(length=2), nullable=False),
            sa.Column("alpha3", sa.String(length=3), nullable=False),
            sa.Column("numeric", sa.String(length=3), nullable=False),
            sa.Column("flag_emoji", sa.String(length=8), nullable=True),
            sa.UniqueConstraint("alpha2", name="uq_countries_alpha2"),
            sa.UniqueConstraint("alpha3", name="uq_countries_alpha3"),
        )
    if not index_exists(bind, "countries", "ix_countries_alpha2"):
        op.create_index("ix_countries_alpha2", "countries", ["alpha2"])
    if not index_exists(bind, "countries", "ix_countries_alpha3"):
        op.create_index("ix_countries_alpha3", "countries", ["alpha3"])
    if not index_exists(bind, "countries", "ix_countries_numeric"):
        op.create_index("ix_countries_numeric", "countries", ["numeric"])

    # 2) assignment table — add columns & index without batch mode
    if table_exists(bind, "assignment"):
        if not column_exists(bind, "assignment", "country_alpha2"):
            op.add_column("assignment", sa.Column("country_alpha2", sa.String(length=2), nullable=True))
        if not column_exists(bind, "assignment", "role"):
            op.add_column("assignment", sa.Column("role", sa.String(length=120), nullable=True))
        if not column_exists(bind, "assignment", "notes"):
            op.add_column("assignment", sa.Column("notes", sa.Text(), nullable=True))

        if not index_exists(bind, "assignment", "ix_assignment_country_alpha2"):
            op.create_index("ix_assignment_country_alpha2", "assignment", ["country_alpha2"])

        # Best-effort FK add to countries.alpha2 (SQLite may ignore/duplicate silently)
        try:
            op.create_foreign_key(
                "fk_assignment_country_alpha2_countries",
                "assignment",
                "countries",
                ["country_alpha2"],
                ["alpha2"],
            )
        except Exception:
            pass

        # NOTE: We are intentionally NOT dropping legacy 'country_id' here to avoid batch mode.
        # If you want to drop it later, we can do a separate, careful migration.

    # 3) missionary table — add columns & index without batch mode
    if table_exists(bind, "missionary"):
        if not column_exists(bind, "missionary", "first_name"):
            op.add_column("missionary", sa.Column("first_name", sa.String(length=120)))
        if not column_exists(bind, "missionary", "last_name"):
            op.add_column("missionary", sa.Column("last_name", sa.String(length=120)))
        if not column_exists(bind, "missionary", "email"):
            op.add_column("missionary", sa.Column("email", sa.String(length=255)))
        if not column_exists(bind, "missionary", "phone"):
            op.add_column("missionary", sa.Column("phone", sa.String(length=50)))
        if not column_exists(bind, "missionary", "display_name"):
            op.add_column("missionary", sa.Column("display_name", sa.String(length=120)))
        if not column_exists(bind, "missionary", "country_alpha2"):
            op.add_column("missionary", sa.Column("country_alpha2", sa.String(length=2)))
        if not index_exists(bind, "missionary", "ix_missionary_country_alpha2"):
            op.create_index("ix_missionary_country_alpha2", "missionary", ["country_alpha2"])

    # 4) report table — add index without batch mode
    if table_exists(bind, "report"):
        if not index_exists(bind, "report", "ix_report_created_at"):
            op.create_index("ix_report_created_at", "report", ["created_at"])

    # 5) user — ensure email index
    if table_exists(bind, "user"):
        if not index_exists(bind, "user", "ix_user_email"):
            op.create_index("ix_user_email", "user", ["email"], unique=False)

# ------------------------------ DOWNGRADE ------------------------------
def downgrade():
    bind = op.get_bind()

    if table_exists(bind, "assignment"):
        try:
            op.drop_index("ix_assignment_country_alpha2", table_name="assignment")
        except Exception:
            pass
        for name in ["country_alpha2", "role", "notes"]:
            if column_exists(bind, "assignment", name):
                try:
                    op.drop_column("assignment", name)
                except Exception:
                    pass

    if table_exists(bind, "missionary"):
        try:
            op.drop_index("ix_missionary_country_alpha2", table_name="missionary")
        except Exception:
            pass
        for name in ["first_name", "last_name", "email", "phone", "display_name", "country_alpha2"]:
            if column_exists(bind, "missionary", name):
                try:
                    op.drop_column("missionary", name)
                except Exception:
                    pass

    if table_exists(bind, "report"):
        try:
            op.drop_index("ix_report_created_at", table_name="report")
        except Exception:
            pass

    if table_exists(bind, "user"):
        try:
            op.drop_index("ix_user_email", table_name="user")
        except Exception:
            pass

    if table_exists(bind, "countries"):
        try:
            op.drop_index("ix_countries_numeric", table_name="countries")
            op.drop_index("ix_countries_alpha3", table_name="countries")
            op.drop_index("ix_countries_alpha2", table_name="countries")
        except Exception:
            pass
        op.drop_table("countries")
