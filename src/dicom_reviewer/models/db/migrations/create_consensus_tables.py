"""
Migration script to create consensus-related tables in the database.
This script should be run after the database is initialized with the base tables.
"""

import sys
import os
import logging
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../')))

from dicom_reviewer.models.db import db
from dicom_reviewer.models.db.consensus import (
    ConsensusSession, ConsensusDiscussion, ConsensusComment, ConsensusVote,
    consensus_annotation_association, consensus_reviewer_association
)
from dicom_reviewer.models.db.annotation import Annotation

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_consensus_tables():
    """Create all the consensus-related tables in the database."""
    try:
        # Check if the annotations table has the consensus-related columns
        with db.engine.connect() as conn:
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'annotations' 
                AND column_name = 'consensus_status'
            """))
            has_consensus_columns = result.fetchone() is not None
        
        # Add consensus-related columns to the annotations table if they don't exist
        if not has_consensus_columns:
            logger.info("Adding consensus columns to annotations table...")
            with db.engine.connect() as conn:
                conn.execute(text("""
                    ALTER TABLE annotations 
                    ADD COLUMN consensus_status VARCHAR(20) DEFAULT 'pending',
                    ADD COLUMN consensus_score FLOAT DEFAULT 0.0,
                    ADD COLUMN is_consensus_result BOOLEAN DEFAULT FALSE
                """))
                conn.commit()
        
        # Create the consensus tables
        logger.info("Creating consensus tables...")
        db.create_all()
        
        logger.info("Consensus tables created successfully!")
        return True
    except SQLAlchemyError as e:
        logger.error(f"Error creating consensus tables: {e}")
        return False

if __name__ == "__main__":
    from dicom_reviewer.main import app
    
    with app.app_context():
        success = create_consensus_tables()
        if success:
            logger.info("Migration completed successfully.")
        else:
            logger.error("Migration failed.")
            sys.exit(1)
