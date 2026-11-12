"""Idempotent, explicitly synthetic demonstration data."""
from sqlalchemy import select
from .database import AttentionRecord, PatientRecord, ResourceConfiguration, SessionLocal


def seed():
    with SessionLocal() as db:
        if not db.get(ResourceConfiguration, 1):
            db.add(ResourceConfiguration(id=1, name="Escenario sintético inicial", doctors=2, triage_staff=1, observation_beds=4))
        for index, level in enumerate([3, 2, 4], 1):
            code = f"DEMO-{index:03d}"
            if db.scalar(select(PatientRecord).where(PatientRecord.code == code)) is None:
                patient = PatientRecord(code=code, triage_level=level)
                db.add(patient)
                db.flush()
                db.add(AttentionRecord(patient_id=patient.id, stage="registered"))
        db.commit()


if __name__ == "__main__":
    seed()
