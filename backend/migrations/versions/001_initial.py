"""Initial schema for Entrega 1; frozen migration, independent of ORM metadata."""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("patients", sa.Column("id", sa.Integer, primary_key=True),
                    sa.Column("code", sa.String(60), unique=True, nullable=False),
                    sa.Column("triage_level", sa.Integer, nullable=False),
                    sa.Column("synthetic", sa.Boolean, nullable=False),
                    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
                    sa.CheckConstraint("triage_level BETWEEN 1 AND 5"))
    op.create_table("attentions", sa.Column("id", sa.Integer, primary_key=True),
                    sa.Column("patient_id", sa.Integer, sa.ForeignKey("patients.id"), unique=True, nullable=False),
                    sa.Column("stage", sa.String(30), nullable=False),
                    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
                    sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
                    sa.CheckConstraint("stage IN ('registered','triage','waiting','consultation','observation','discharged')"))
    op.create_table("resource_configurations", sa.Column("id", sa.Integer, primary_key=True),
                    sa.Column("name", sa.String(100), nullable=False), sa.Column("doctors", sa.Integer, nullable=False),
                    sa.Column("triage_staff", sa.Integer, nullable=False), sa.Column("observation_beds", sa.Integer, nullable=False),
                    sa.Column("synthetic", sa.Boolean, nullable=False),
                    sa.CheckConstraint("doctors > 0 AND triage_staff > 0 AND observation_beds > 0"))
    op.create_table("simulation_runs", sa.Column("id", sa.String(36), primary_key=True),
                    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
                    sa.Column("config", sa.JSON, nullable=False), sa.Column("result", sa.JSON, nullable=False),
                    sa.Column("elapsed_seconds", sa.Float, nullable=False), sa.Column("synthetic", sa.Boolean, nullable=False))
    op.create_table("telemetry", sa.Column("id", sa.Integer, primary_key=True),
                    sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
                    sa.Column("simulation_id", sa.String(36), sa.ForeignKey("simulation_runs.id"), nullable=True),
                    sa.Column("source", sa.String(30), nullable=False), sa.Column("metrics", sa.JSON, nullable=False))


def downgrade():
    for table in ["telemetry", "simulation_runs", "resource_configurations", "attentions", "patients"]:
        op.drop_table(table)
