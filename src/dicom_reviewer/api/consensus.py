"""
API endpoints for the Consensus Dashboard.

This module provides the API endpoints for creating and managing consensus sessions,
discussions, and votes between multiple reviewers.
"""

from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
import logging

from dicom_reviewer.models.db import db
from dicom_reviewer.models.db.annotation import Annotation
from dicom_reviewer.models.db.consensus import ConsensusSession, ConsensusDiscussion, ConsensusComment, ConsensusVote
from dicom_reviewer.models.consensus_engine import ConsensusEngine

# Configure logging
logger = logging.getLogger(__name__)

# Create blueprint
consensus_bp = Blueprint('consensus', __name__)

@consensus_bp.route('/api/consensus/sessions', methods=['POST'])
@login_required
def create_session():
    """Create a new consensus session."""
    try:
        data = request.json
        
        if not data or not data.get('studyUid') or not data.get('title'):
            return jsonify({'error': 'Missing required fields'}), 400
        
        session = ConsensusEngine.create_consensus_session(
            study_uid=data.get('studyUid'),
            title=data.get('title'),
            creator_id=current_user.id,
            description=data.get('description')
        )
        
        # Add reviewers if provided
        reviewer_ids = data.get('reviewerIds', [])
        if reviewer_ids:
            ConsensusEngine.add_reviewers_to_session(session.id, reviewer_ids)
        
        # Add annotations if provided
        annotation_ids = data.get('annotationIds', [])
        if annotation_ids:
            ConsensusEngine.add_annotations_to_session(session.id, annotation_ids)
        
        return jsonify(session.to_dict()), 201
    
    except Exception as e:
        logger.error(f"Error creating consensus session: {e}")
        return jsonify({'error': 'Failed to create consensus session'}), 500

@consensus_bp.route('/api/consensus/sessions', methods=['GET'])
@login_required
def get_sessions():
    """Get all consensus sessions for the current user."""
    try:
        # Get query parameters
        study_uid = request.args.get('studyUid')
        status = request.args.get('status')
        
        # Base query
        query = ConsensusSession.query
        
        # Apply filters
        if study_uid:
            query = query.filter(ConsensusSession.study_uid == study_uid)
        
        if status:
            query = query.filter(ConsensusSession.status == status)
        
        # Get sessions where user is creator or reviewer
        sessions = query.filter(
            (ConsensusSession.creator_id == current_user.id) | 
            (ConsensusSession.reviewers.any(id=current_user.id))
        ).all()
        
        return jsonify([session.to_dict() for session in sessions]), 200
    
    except Exception as e:
        logger.error(f"Error getting consensus sessions: {e}")
        return jsonify({'error': 'Failed to retrieve consensus sessions'}), 500

@consensus_bp.route('/api/consensus/sessions/<session_id>', methods=['GET'])
@login_required
def get_session(session_id):
    """Get a specific consensus session."""
    try:
        session = ConsensusSession.query.get(session_id)
        
        if not session:
            return jsonify({'error': 'Consensus session not found'}), 404
        
        # Check if user has access to this session
        if session.creator_id != current_user.id and current_user not in session.reviewers:
            return jsonify({'error': 'Access denied'}), 403
        
        return jsonify(session.to_dict()), 200
    
    except Exception as e:
        logger.error(f"Error getting consensus session: {e}")
        return jsonify({'error': 'Failed to retrieve consensus session'}), 500

@consensus_bp.route('/api/consensus/sessions/<session_id>/annotations', methods=['GET'])
@login_required
def get_session_annotations(session_id):
    """Get all annotations for a consensus session."""
    try:
        session = ConsensusSession.query.get(session_id)
        
        if not session:
            return jsonify({'error': 'Consensus session not found'}), 404
        
        # Check if user has access to this session
        if session.creator_id != current_user.id and current_user not in session.reviewers:
            return jsonify({'error': 'Access denied'}), 403
        
        # Get annotations
        annotations = session.annotations
        
        return jsonify([ann.to_dict() for ann in annotations]), 200
    
    except Exception as e:
        logger.error(f"Error getting session annotations: {e}")
        return jsonify({'error': 'Failed to retrieve session annotations'}), 500

@consensus_bp.route('/api/consensus/sessions/<session_id>/annotations', methods=['POST'])
@login_required
def add_annotations_to_session(session_id):
    """Add annotations to a consensus session."""
    try:
        data = request.json
        
        if not data or not data.get('annotationIds'):
            return jsonify({'error': 'Missing annotation IDs'}), 400
        
        session = ConsensusSession.query.get(session_id)
        
        if not session:
            return jsonify({'error': 'Consensus session not found'}), 404
        
        # Check if user has access to this session
        if session.creator_id != current_user.id and current_user not in session.reviewers:
            return jsonify({'error': 'Access denied'}), 403
        
        # Add annotations
        success = ConsensusEngine.add_annotations_to_session(
            session_id=session_id,
            annotation_ids=data.get('annotationIds')
        )
        
        if not success:
            return jsonify({'error': 'Failed to add annotations'}), 500
        
        return jsonify({'success': True}), 200
    
    except Exception as e:
        logger.error(f"Error adding annotations to session: {e}")
        return jsonify({'error': 'Failed to add annotations to session'}), 500

@consensus_bp.route('/api/consensus/sessions/<session_id>/reviewers', methods=['POST'])
@login_required
def add_reviewers_to_session(session_id):
    """Add reviewers to a consensus session."""
    try:
        data = request.json
        
        if not data or not data.get('reviewerIds'):
            return jsonify({'error': 'Missing reviewer IDs'}), 400
        
        session = ConsensusSession.query.get(session_id)
        
        if not session:
            return jsonify({'error': 'Consensus session not found'}), 404
        
        # Only the creator can add reviewers
        if session.creator_id != current_user.id:
            return jsonify({'error': 'Only the creator can add reviewers'}), 403
        
        # Add reviewers
        success = ConsensusEngine.add_reviewers_to_session(
            session_id=session_id,
            reviewer_ids=data.get('reviewerIds')
        )
        
        if not success:
            return jsonify({'error': 'Failed to add reviewers'}), 500
        
        return jsonify({'success': True}), 200
    
    except Exception as e:
        logger.error(f"Error adding reviewers to session: {e}")
        return jsonify({'error': 'Failed to add reviewers to session'}), 500

@consensus_bp.route('/api/consensus/sessions/<session_id>/discussions', methods=['POST'])
@login_required
def create_discussion(session_id):
    """Create a new discussion in a consensus session."""
    try:
        data = request.json
        
        if not data or not data.get('title'):
            return jsonify({'error': 'Missing required fields'}), 400
        
        session = ConsensusSession.query.get(session_id)
        
        if not session:
            return jsonify({'error': 'Consensus session not found'}), 404
        
        # Check if user has access to this session
        if session.creator_id != current_user.id and current_user not in session.reviewers:
            return jsonify({'error': 'Access denied'}), 403
        
        # Create discussion
        discussion = ConsensusEngine.create_consensus_discussion(
            session_id=session_id,
            title=data.get('title'),
            creator_id=current_user.id,
            annotation_id=data.get('annotationId')
        )
        
        if not discussion:
            return jsonify({'error': 'Failed to create discussion'}), 500
        
        return jsonify(discussion.to_dict()), 201
    
    except Exception as e:
        logger.error(f"Error creating discussion: {e}")
        return jsonify({'error': 'Failed to create discussion'}), 500

@consensus_bp.route('/api/consensus/sessions/<session_id>/discussions', methods=['GET'])
@login_required
def get_discussions(session_id):
    """Get all discussions for a consensus session."""
    try:
        session = ConsensusSession.query.get(session_id)
        
        if not session:
            return jsonify({'error': 'Consensus session not found'}), 404
        
        # Check if user has access to this session
        if session.creator_id != current_user.id and current_user not in session.reviewers:
            return jsonify({'error': 'Access denied'}), 403
        
        # Get discussions
        discussions = session.discussions
        
        return jsonify([discussion.to_dict() for discussion in discussions]), 200
    
    except Exception as e:
        logger.error(f"Error getting discussions: {e}")
        return jsonify({'error': 'Failed to retrieve discussions'}), 500

@consensus_bp.route('/api/consensus/discussions/<discussion_id>/comments', methods=['POST'])
@login_required
def add_comment(discussion_id):
    """Add a comment to a discussion."""
    try:
        data = request.json
        
        if not data or not data.get('content'):
            return jsonify({'error': 'Missing comment content'}), 400
        
        discussion = ConsensusDiscussion.query.get(discussion_id)
        
        if not discussion:
            return jsonify({'error': 'Discussion not found'}), 404
        
        # Get the session to check access
        session = discussion.session
        
        # Check if user has access to this session
        if session.creator_id != current_user.id and current_user not in session.reviewers:
            return jsonify({'error': 'Access denied'}), 403
        
        # Create comment
        comment = ConsensusComment(
            discussion_id=discussion_id,
            content=data.get('content'),
            author_id=current_user.id
        )
        
        db.session.add(comment)
        db.session.commit()
        
        return jsonify(comment.to_dict()), 201
    
    except Exception as e:
        logger.error(f"Error adding comment: {e}")
        db.session.rollback()
        return jsonify({'error': 'Failed to add comment'}), 500

@consensus_bp.route('/api/consensus/discussions/<discussion_id>/comments', methods=['GET'])
@login_required
def get_comments(discussion_id):
    """Get all comments for a discussion."""
    try:
        discussion = ConsensusDiscussion.query.get(discussion_id)
        
        if not discussion:
            return jsonify({'error': 'Discussion not found'}), 404
        
        # Get the session to check access
        session = discussion.session
        
        # Check if user has access to this session
        if session.creator_id != current_user.id and current_user not in session.reviewers:
            return jsonify({'error': 'Access denied'}), 403
        
        # Get comments
        comments = discussion.comments
        
        return jsonify([comment.to_dict() for comment in comments]), 200
    
    except Exception as e:
        logger.error(f"Error getting comments: {e}")
        return jsonify({'error': 'Failed to retrieve comments'}), 500

@consensus_bp.route('/api/consensus/sessions/<session_id>/votes', methods=['POST'])
@login_required
def cast_vote(session_id):
    """Cast a vote in a consensus session."""
    try:
        data = request.json
        
        if not data or not data.get('value'):
            return jsonify({'error': 'Missing vote value'}), 400
        
        session = ConsensusSession.query.get(session_id)
        
        if not session:
            return jsonify({'error': 'Consensus session not found'}), 404
        
        # Check if user has access to this session
        if session.creator_id != current_user.id and current_user not in session.reviewers:
            return jsonify({'error': 'Access denied'}), 403
        
        # Create vote
        vote = ConsensusVote(
            session_id=session_id,
            reviewer_id=current_user.id,
            value=data.get('value'),
            annotation_id=data.get('annotationId'),
            discussion_id=data.get('discussionId')
        )
        
        db.session.add(vote)
        db.session.commit()
        
        return jsonify(vote.to_dict()), 201
    
    except Exception as e:
        logger.error(f"Error casting vote: {e}")
        db.session.rollback()
        return jsonify({'error': 'Failed to cast vote'}), 500

@consensus_bp.route('/api/consensus/sessions/<session_id>/votes', methods=['GET'])
@login_required
def get_votes(session_id):
    """Get all votes for a consensus session."""
    try:
        session = ConsensusSession.query.get(session_id)
        
        if not session:
            return jsonify({'error': 'Consensus session not found'}), 404
        
        # Check if user has access to this session
        if session.creator_id != current_user.id and current_user not in session.reviewers:
            return jsonify({'error': 'Access denied'}), 403
        
        # Get votes
        votes = session.votes
        
        return jsonify([vote.to_dict() for vote in votes]), 200
    
    except Exception as e:
        logger.error(f"Error getting votes: {e}")
        return jsonify({'error': 'Failed to retrieve votes'}), 500

@consensus_bp.route('/api/consensus/sessions/<session_id>/discrepancies', methods=['GET'])
@login_required
def get_discrepancies(session_id):
    """Get discrepancies for a consensus session."""
    try:
        session = ConsensusSession.query.get(session_id)
        
        if not session:
            return jsonify({'error': 'Consensus session not found'}), 404
        
        # Check if user has access to this session
        if session.creator_id != current_user.id and current_user not in session.reviewers:
            return jsonify({'error': 'Access denied'}), 403
        
        # Get annotations for this session
        annotations = session.annotations
        
        # Detect discrepancies
        discrepancies = ConsensusEngine.detect_discrepancies(annotations)
        
        return jsonify(discrepancies), 200
    
    except Exception as e:
        logger.error(f"Error getting discrepancies: {e}")
        return jsonify({'error': 'Failed to retrieve discrepancies'}), 500

@consensus_bp.route('/api/consensus/sessions/<session_id>/reliability', methods=['GET'])
@login_required
def get_reliability(session_id):
    """Get inter-rater reliability metrics for a consensus session."""
    try:
        session = ConsensusSession.query.get(session_id)
        
        if not session:
            return jsonify({'error': 'Consensus session not found'}), 404
        
        # Check if user has access to this session
        if session.creator_id != current_user.id and current_user not in session.reviewers:
            return jsonify({'error': 'Access denied'}), 403
        
        # Get annotations for this session
        annotations = session.annotations
        
        # Calculate reliability metrics
        reliability = ConsensusEngine.calculate_inter_rater_reliability(annotations)
        
        return jsonify(reliability), 200
    
    except Exception as e:
        logger.error(f"Error getting reliability metrics: {e}")
        return jsonify({'error': 'Failed to retrieve reliability metrics'}), 500

@consensus_bp.route('/api/consensus/sessions/<session_id>/result', methods=['POST'])
@login_required
def create_consensus_result(session_id):
    """Create a consensus result annotation."""
    try:
        data = request.json
        
        if not data or not data.get('finding'):
            return jsonify({'error': 'Missing required fields'}), 400
        
        session = ConsensusSession.query.get(session_id)
        
        if not session:
            return jsonify({'error': 'Consensus session not found'}), 404
        
        # Only the creator can create a consensus result
        if session.creator_id != current_user.id:
            return jsonify({'error': 'Only the creator can create a consensus result'}), 403
        
        # Create consensus result
        result = ConsensusEngine.create_consensus_result(
            session_id=session_id,
            reviewer_id=current_user.id,
            finding=data.get('finding'),
            confidence_level=data.get('confidenceLevel', 10.0),
            study_uid=session.study_uid,
            series_uid=data.get('seriesUid'),
            instance_uid=data.get('instanceUid')
        )
        
        if not result:
            return jsonify({'error': 'Failed to create consensus result'}), 500
        
        return jsonify(result.to_dict()), 201
    
    except Exception as e:
        logger.error(f"Error creating consensus result: {e}")
        return jsonify({'error': 'Failed to create consensus result'}), 500
