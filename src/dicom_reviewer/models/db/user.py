from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime, timedelta
import bcrypt
import uuid
import logging

# Configure logging
logger = logging.getLogger(__name__)

# Import the db instance from the db package instead of creating a new one
from dicom_reviewer.models.db import db

class User(db.Model, UserMixin):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    full_name = db.Column(db.String(150), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='radiologist')
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
    
    def __init__(self, **kwargs):
        super(User, self).__init__(**kwargs)
        logger.info(f"Creating user: {kwargs.get('username')}")
    
    def set_password(self, password):
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    def check_password(self, password):
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
    
    def get_id(self):
        return str(self.id)

class Session(db.Model):
    __tablename__ = 'sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    session_token = db.Column(db.String(128), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    
    user = db.relationship('User', backref=db.backref('sessions', lazy=True))
    
    @classmethod
    def create_session(cls, user_id, expires_in_days=7):
        session = cls(
            user_id=user_id,
            session_token=str(uuid.uuid4()),
            expires_at=datetime.utcnow() + timedelta(days=expires_in_days)
        )
        db.session.add(session)
        db.session.commit()
        return session
    
    @classmethod
    def get_user_by_token(cls, token):
        session = cls.query.filter_by(session_token=token).first()
        if not session or session.expires_at < datetime.utcnow():
            return None
        return session.user