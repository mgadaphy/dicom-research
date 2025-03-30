"""
Migration script to update the annotations table with consensus-related columns.
"""

import logging
from sqlalchemy import text
from dicom_reviewer.models.db import db

# Configure logging
logger = logging.getLogger(__name__)

def update_annotations_table():
    """
    Add consensus-related columns to the annotations table if they don't exist.
    """
    try:
        # Check if the consensus_status column exists
        result = db.session.execute(text("PRAGMA table_info(annotations)")).fetchall()
        columns = [row[1] for row in result]
        
        # Add missing columns if they don't exist
        if 'consensus_status' not in columns:
            logger.info("Adding consensus_status column to annotations table")
            db.session.execute(text("ALTER TABLE annotations ADD COLUMN consensus_status VARCHAR(20) DEFAULT 'pending'"))
        
        if 'consensus_score' not in columns:
            logger.info("Adding consensus_score column to annotations table")
            db.session.execute(text("ALTER TABLE annotations ADD COLUMN consensus_score FLOAT DEFAULT 0.0"))
        
        if 'is_consensus_result' not in columns:
            logger.info("Adding is_consensus_result column to annotations table")
            db.session.execute(text("ALTER TABLE annotations ADD COLUMN is_consensus_result BOOLEAN DEFAULT 0"))
        
        db.session.commit()
        logger.info("Successfully updated annotations table with consensus columns")
        return True
    except Exception as e:
        logger.error(f"Error updating annotations table: {e}")
        db.session.rollback()
        return False
