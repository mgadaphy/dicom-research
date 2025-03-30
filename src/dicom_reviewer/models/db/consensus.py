"""
Database models for the Consensus Dashboard.

This module contains the database models for tracking consensus sessions,
discussions, and votes between multiple reviewers.
"""

import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional
import json

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property

from dicom_reviewer.models.db import db
from dicom_reviewer.models.db.user import User
from dicom_reviewer.models.db.annotation import Annotation

class ConsensusSession(db.Model):
    """
    Represents a consensus review session between multiple reviewers.
    
    A consensus session is created when multiple reviewers want to compare
    their annotations and reach a consensus on findings.
    """
    __tablename__ = 'consensus_sessions'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    study_uid = db.Column(db.String(64), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status = db.Column(db.String(20), default='active')  # active, completed, archived
    
    # Creator of the consensus session
    creator_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    creator = relationship('User', foreign_keys=[creator_id])
    
    # Relationships
    discussions = relationship('ConsensusDiscussion', back_populates='session', cascade='all, delete-orphan')
    votes = relationship('ConsensusVote', back_populates='session', cascade='all, delete-orphan')
    
    # Many-to-many relationship with annotations
    annotations = db.relationship('Annotation', 
                                secondary='consensus_annotation_association',
                                backref=db.backref('consensus_sessions', lazy='dynamic'))
    
    # Many-to-many relationship with reviewers (users)
    reviewers = db.relationship('User',
                               secondary='consensus_reviewer_association',
                               backref=db.backref('consensus_sessions', lazy='dynamic'))
    
    @hybrid_property
    def reviewer_count(self) -> int:
        """Return the number of reviewers in this session."""
        return len(self.reviewers)
    
    @hybrid_property
    def annotation_count(self) -> int:
        """Return the number of annotations in this session."""
        return len(self.annotations)
    
    @hybrid_property
    def discussion_count(self) -> int:
        """Return the number of discussions in this session."""
        return len(self.discussions)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert the session to a dictionary for JSON serialization."""
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'studyUid': self.study_uid,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
            'status': self.status,
            'creatorId': self.creator_id,
            'creatorName': self.creator.username if self.creator else None,
            'reviewerCount': self.reviewer_count,
            'annotationCount': self.annotation_count,
            'discussionCount': self.discussion_count
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ConsensusSession':
        """Create a ConsensusSession from a dictionary."""
        session = cls(
            id=data.get('id', str(uuid.uuid4())),
            title=data.get('title'),
            description=data.get('description'),
            study_uid=data.get('studyUid'),
            status=data.get('status', 'active'),
            creator_id=data.get('creatorId')
        )
        return session


class ConsensusDiscussion(db.Model):
    """
    Represents a discussion thread within a consensus session.
    
    Discussions are created to address specific discrepancies or topics
    within a consensus review session.
    """
    __tablename__ = 'consensus_discussions'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = db.Column(db.String(36), db.ForeignKey('consensus_sessions.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status = db.Column(db.String(20), default='open')  # open, resolved, closed
    
    # Creator of the discussion
    creator_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    creator = relationship('User', foreign_keys=[creator_id])
    
    # Optional reference to specific annotations
    annotation_id = db.Column(db.String(36), db.ForeignKey('annotations.id'), nullable=True)
    annotation = relationship('Annotation', foreign_keys=[annotation_id])
    
    # Relationships
    session = relationship('ConsensusSession', back_populates='discussions')
    comments = relationship('ConsensusComment', back_populates='discussion', cascade='all, delete-orphan')
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert the discussion to a dictionary for JSON serialization."""
        return {
            'id': self.id,
            'sessionId': self.session_id,
            'title': self.title,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
            'status': self.status,
            'creatorId': self.creator_id,
            'creatorName': self.creator.username if self.creator else None,
            'annotationId': self.annotation_id,
            'commentCount': len(self.comments)
        }


class ConsensusComment(db.Model):
    """
    Represents a comment within a consensus discussion thread.
    """
    __tablename__ = 'consensus_comments'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    discussion_id = db.Column(db.String(36), db.ForeignKey('consensus_discussions.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Author of the comment
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    author = relationship('User', foreign_keys=[author_id])
    
    # Relationships
    discussion = relationship('ConsensusDiscussion', back_populates='comments')
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert the comment to a dictionary for JSON serialization."""
        return {
            'id': self.id,
            'discussionId': self.discussion_id,
            'content': self.content,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
            'authorId': self.author_id,
            'authorName': self.author.username if self.author else None
        }


class ConsensusVote(db.Model):
    """
    Represents a vote cast by a reviewer in a consensus session.
    
    Votes can be associated with specific annotations or discussions
    to indicate agreement or disagreement.
    """
    __tablename__ = 'consensus_votes'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = db.Column(db.String(36), db.ForeignKey('consensus_sessions.id'), nullable=False)
    value = db.Column(db.String(20), nullable=False)  # agree, disagree, abstain
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Voter
    reviewer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    reviewer = relationship('User', foreign_keys=[reviewer_id])
    
    # Optional reference to specific annotation or discussion
    annotation_id = db.Column(db.String(36), db.ForeignKey('annotations.id'), nullable=True)
    annotation = relationship('Annotation', foreign_keys=[annotation_id])
    
    discussion_id = db.Column(db.String(36), db.ForeignKey('consensus_discussions.id'), nullable=True)
    discussion = relationship('ConsensusDiscussion', foreign_keys=[discussion_id])
    
    # Relationships
    session = relationship('ConsensusSession', back_populates='votes')
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert the vote to a dictionary for JSON serialization."""
        return {
            'id': self.id,
            'sessionId': self.session_id,
            'value': self.value,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
            'reviewerId': self.reviewer_id,
            'reviewerName': self.reviewer.username if self.reviewer else None,
            'annotationId': self.annotation_id,
            'discussionId': self.discussion_id
        }


# Association tables for many-to-many relationships

# Association between consensus sessions and annotations
consensus_annotation_association = db.Table(
    'consensus_annotation_association',
    db.Column('consensus_session_id', db.String(36), db.ForeignKey('consensus_sessions.id'), primary_key=True),
    db.Column('annotation_id', db.String(36), db.ForeignKey('annotations.id'), primary_key=True)
)

# Association between consensus sessions and reviewers
consensus_reviewer_association = db.Table(
    'consensus_reviewer_association',
    db.Column('consensus_session_id', db.String(36), db.ForeignKey('consensus_sessions.id'), primary_key=True),
    db.Column('reviewer_id', db.Integer, db.ForeignKey('users.id'), primary_key=True)
)
