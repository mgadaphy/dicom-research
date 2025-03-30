from datetime import datetime
import json
import uuid
import logging
from sqlalchemy.ext.hybrid import hybrid_property
from dicom_reviewer.models.db import db
from dicom_reviewer.models.db.user import User

# Configure logging
logger = logging.getLogger(__name__)

class Annotation(db.Model):
    """
    Database model for persistent annotation storage
    """
    __tablename__ = 'annotations'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    study_uid = db.Column(db.String(64), nullable=False, index=True)
    series_uid = db.Column(db.String(64), nullable=True)
    instance_uid = db.Column(db.String(64), nullable=True)
    
    # Foreign key relationship with user
    reviewer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    reviewer = db.relationship('User', backref=db.backref('annotations', lazy=True))
    
    # Annotation metadata
    finding = db.Column(db.String(255), nullable=True)
    confidence_level = db.Column(db.Float, default=0.0)
    notes = db.Column(db.Text, nullable=True)
    
    # Consensus-related fields
    consensus_status = db.Column(db.String(20), default='pending')  # pending, agreed, disputed
    consensus_score = db.Column(db.Float, default=0.0)  # Agreement score (0-1)
    is_consensus_result = db.Column(db.Boolean, default=False)  # Whether this annotation is a consensus result
    
    # Annotation data (stored as JSON)
    _region_data = db.Column('region_data', db.Text, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    @hybrid_property
    def region_data(self):
        """Get the region data as a Python object"""
        if self._region_data:
            try:
                return json.loads(self._region_data)
            except json.JSONDecodeError as e:
                logger.error(f"Error decoding region data for annotation {self.id}: {e}")
                return []
        return []
    
    @region_data.setter
    def region_data(self, data):
        """Store the region data as JSON"""
        if data is None:
            self._region_data = None
        else:
            try:
                self._region_data = json.dumps(data)
                logger.debug(f"Stored region data for annotation {self.id}: {len(data)} shapes")
            except (TypeError, ValueError) as e:
                logger.error(f"Error encoding region data for annotation {self.id}: {e}")
                self._region_data = json.dumps([])
    
    def to_dict(self):
        """Convert annotation to dictionary for API responses"""
        return {
            'id': self.id,
            'studyUid': self.study_uid,
            'seriesUid': self.series_uid,
            'instanceUid': self.instance_uid,
            'reviewerId': self.reviewer.username,  # Use username instead of ID for API
            'finding': self.finding,
            'confidence': self.confidence_level,  # Changed from confidenceLevel to confidence
            'notes': self.notes,
            'shapes': self.region_data,  # Changed from regionData to shapes
            'consensusStatus': self.consensus_status,
            'consensusScore': self.consensus_score,
            'isConsensusResult': self.is_consensus_result,
            'createdAt': self.created_at.isoformat(),
            'updatedAt': self.updated_at.isoformat(),
            'timestamp': self.created_at.isoformat()  # Added for compatibility with frontend
        }
    
    @classmethod
    def from_dict(cls, data, reviewer_id=None):
        """Create an annotation from a dictionary"""
        # Log the incoming data structure
        logger.info(f"Creating annotation from data: studyUid={data.get('studyUid')}, "
                   f"finding={data.get('finding')}, shapes={len(data.get('shapes', []))}")
        
        annotation = cls(
            id=data.get('id', str(uuid.uuid4())),
            study_uid=data.get('studyUid'),
            series_uid=data.get('seriesUid'),
            instance_uid=data.get('instanceUid'),
            reviewer_id=reviewer_id,
            finding=data.get('finding'),
            confidence_level=data.get('confidence', 0.0),  # Changed from confidenceLevel to confidence
            notes=data.get('notes'),
            consensus_status=data.get('consensusStatus', 'pending'),
            consensus_score=data.get('consensusScore', 0.0),
            is_consensus_result=data.get('isConsensusResult', False)
        )
        
        # Set region data if provided
        shapes = data.get('shapes')  # Changed from regionData to shapes
        if shapes:
            annotation.region_data = shapes
            
        return annotation
