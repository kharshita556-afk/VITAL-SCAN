from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Patient(db.Model):
    __tablename__ = 'patients'

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    dob = db.Column(db.String(10), nullable=False)  # Format: YYYY-MM-DD
    email = db.Column(db.String(120), nullable=False)
    glucose = db.Column(db.Float, nullable=False)
    haemoglobin = db.Column(db.Float, nullable=False)
    cholesterol = db.Column(db.Float, nullable=False)
    remarks = db.Column(db.Text, nullable=True)
    risk_level = db.Column(db.String(20), nullable=True)  # "Normal", "Moderate Risk", "High Risk"
    condition = db.Column(db.String(50), nullable=True)   # "Diabetes", "Anemia", "Healthy", "Hypercholesterolemia"
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship to history
    history = db.relationship('BloodHistory', backref='patient', cascade='all, delete-orphan', lazy=True)

    @property
    def age(self):
        if not self.dob:
            return 0
        try:
            birth_date = datetime.strptime(self.dob, "%Y-%m-%d")
            today = datetime.now()
            age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
            return age
        except Exception:
            return 0

    def to_dict(self):
        return {
            "id": self.id,
            "full_name": self.full_name,
            "dob": self.dob,
            "age": self.age,
            "email": self.email,
            "glucose": self.glucose,
            "haemoglobin": self.haemoglobin,
            "cholesterol": self.cholesterol,
            "remarks": self.remarks,
            "risk_level": self.risk_level,
            "condition": self.condition,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else None,
            "history": [h.to_dict() for h in sorted(self.history, key=lambda x: x.changed_at, reverse=True)]
        }

class BloodHistory(db.Model):
    __tablename__ = 'blood_history'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    change_desc = db.Column(db.Text, nullable=False)
    changed_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "change_desc": self.change_desc,
            "changed_at": self.changed_at.strftime("%d %b %Y, %H:%M") if self.changed_at else None
        }
