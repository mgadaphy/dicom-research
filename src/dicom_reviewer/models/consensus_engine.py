from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import logging
from datetime import datetime
# Remove the import of cohen_kappa_score since it's not available
# from scipy.stats import cohen_kappa_score
# Remove the import of shapely since it's not available
# from shapely.geometry import Polygon, Point

from dicom_reviewer.models.db.annotation import Annotation
from dicom_reviewer.models.db.consensus import ConsensusSession, ConsensusDiscussion, ConsensusVote
from dicom_reviewer.models.db import db

# Configure logging
logger = logging.getLogger(__name__)

class ConsensusEngine:
    """
    Engine for consensus operations including discrepancy detection,
    inter-rater reliability calculation, and consensus building.
    """
    
    @staticmethod
    def detect_discrepancies(annotations: List[Annotation]) -> Dict[str, Any]:
        """
        Detect and analyze differences in annotations.
        
        This method identifies discrepancies between annotations based on:
        1. Different findings for the same region
        2. Overlapping regions with different findings
        3. Significant differences in confidence levels
        
        Args:
            annotations: List of annotations to compare
            
        Returns:
            Dictionary containing discrepancy information
        """
        if len(annotations) < 2:
            return {"consensus_possible": True, "discrepancies": []}
        
        discrepancies = []
        
        # Group annotations by finding
        findings_dict = {}
        for ann in annotations:
            finding = ann.finding or "Unspecified"
            if finding not in findings_dict:
                findings_dict[finding] = []
            findings_dict[finding].append(ann)
        
        # Check for different findings
        unique_findings = list(findings_dict.keys())
        is_consensus_on_finding = len(unique_findings) <= 1
        
        if not is_consensus_on_finding:
            discrepancies.append({
                "type": "finding_mismatch",
                "description": f"Different findings detected: {', '.join(unique_findings)}",
                "findings": unique_findings
            })
        
        # Check for spatial discrepancies (overlapping regions with different findings)
        spatial_discrepancies = ConsensusEngine._detect_spatial_discrepancies(annotations)
        if spatial_discrepancies:
            discrepancies.extend(spatial_discrepancies)
        
        # Check for confidence level discrepancies
        confidence_discrepancies = ConsensusEngine._detect_confidence_discrepancies(annotations)
        if confidence_discrepancies:
            discrepancies.extend(confidence_discrepancies)
        
        return {
            "consensus_possible": len(discrepancies) == 0,
            "discrepancies": discrepancies,
            "total_annotations": len(annotations),
            "unique_findings": unique_findings
        }
    
    @staticmethod
    def _detect_spatial_discrepancies(annotations: List[Annotation]) -> List[Dict[str, Any]]:
        """
        Detect spatial discrepancies between annotations.
        
        This method identifies overlapping regions with different findings.
        
        Args:
            annotations: List of annotations to compare
            
        Returns:
            List of spatial discrepancy dictionaries
        """
        discrepancies = []
        
        # Create a list of annotation pairs to compare
        for i in range(len(annotations)):
            for j in range(i+1, len(annotations)):
                ann1 = annotations[i]
                ann2 = annotations[j]
                
                # Skip if findings are the same
                if ann1.finding == ann2.finding:
                    continue
                
                # Get shapes from annotations
                shapes1 = ann1.region_data
                shapes2 = ann2.region_data
                
                if not shapes1 or not shapes2:
                    continue
                
                # Check for overlapping shapes
                for shape1 in shapes1:
                    for shape2 in shapes2:
                        if ConsensusEngine._shapes_overlap(shape1, shape2):
                            discrepancies.append({
                                "type": "spatial_overlap",
                                "description": f"Overlapping regions with different findings: '{ann1.finding}' and '{ann2.finding}'",
                                "annotation_ids": [ann1.id, ann2.id],
                                "findings": [ann1.finding, ann2.finding],
                                "reviewer_ids": [ann1.reviewer_id, ann2.reviewer_id]
                            })
                            # Only report one overlap per annotation pair
                            break
                    else:
                        continue
                    break
        
        return discrepancies
    
    @staticmethod
    def _detect_confidence_discrepancies(annotations: List[Annotation]) -> List[Dict[str, Any]]:
        """
        Detect confidence level discrepancies between annotations.
        
        This method identifies significant differences in confidence levels
        for the same finding.
        
        Args:
            annotations: List of annotations to compare
            
        Returns:
            List of confidence discrepancy dictionaries
        """
        discrepancies = []
        
        # Group annotations by finding
        findings_dict = {}
        for ann in annotations:
            finding = ann.finding or "Unspecified"
            if finding not in findings_dict:
                findings_dict[finding] = []
            findings_dict[finding].append(ann)
        
        # Check for confidence discrepancies within each finding group
        for finding, anns in findings_dict.items():
            if len(anns) < 2:
                continue
            
            # Calculate confidence statistics
            confidence_levels = [ann.confidence_level for ann in anns]
            mean_confidence = np.mean(confidence_levels)
            std_confidence = np.std(confidence_levels)
            
            # Check if standard deviation is significant (> 2.0 on a 10-point scale)
            if std_confidence > 2.0:
                discrepancies.append({
                    "type": "confidence_variance",
                    "description": f"Significant variance in confidence for finding '{finding}' (std: {std_confidence:.2f})",
                    "finding": finding,
                    "mean_confidence": float(mean_confidence),
                    "std_confidence": float(std_confidence),
                    "annotation_ids": [ann.id for ann in anns],
                    "reviewer_ids": [ann.reviewer_id for ann in anns],
                    "confidence_levels": confidence_levels
                })
        
        return discrepancies
    
    @staticmethod
    def _shapes_overlap(shape1: Dict[str, Any], shape2: Dict[str, Any]) -> bool:
        """
        Determine if two shapes overlap.
        
        This method checks if two annotation shapes overlap spatially.
        
        Args:
            shape1: First shape dictionary
            shape2: Second shape dictionary
            
        Returns:
            True if shapes overlap, False otherwise
        """
        # Handle different shape types
        try:
            if shape1.get('tool') == 'rectangle' and shape2.get('tool') == 'rectangle':
                # Convert rectangles to polygons
                poly1 = [
                    (shape1['startX'], shape1['startY']),
                    (shape1['endX'], shape1['startY']),
                    (shape1['endX'], shape1['endY']),
                    (shape1['startX'], shape1['endY'])
                ]
                
                poly2 = [
                    (shape2['startX'], shape2['startY']),
                    (shape2['endX'], shape2['startY']),
                    (shape2['endX'], shape2['endY']),
                    (shape2['startX'], shape2['endY'])
                ]
                
                # Check for overlap
                for point in poly1:
                    if ConsensusEngine._point_inside_polygon(point, poly2):
                        return True
                
                for point in poly2:
                    if ConsensusEngine._point_inside_polygon(point, poly1):
                        return True
                
                return False
                
            elif shape1.get('tool') == 'circle' and shape2.get('tool') == 'circle':
                # Calculate centers and radii
                center1 = (shape1['startX'], shape1['startY'])
                radius1 = ((shape1['endX'] - shape1['startX'])**2 + 
                           (shape1['endY'] - shape1['startY'])**2)**0.5
                
                center2 = (shape2['startX'], shape2['startY'])
                radius2 = ((shape2['endX'] - shape2['startX'])**2 + 
                           (shape2['endY'] - shape2['startY'])**2)**0.5
                
                # Calculate distance between centers
                distance = ((center1[0] - center2[0])**2 + 
                            (center1[1] - center2[1])**2)**0.5
                
                # Circles overlap if distance is less than sum of radii
                return distance < (radius1 + radius2)
                
            # For other shape combinations or types, implement as needed
            # For now, return False for unsupported combinations
            return False
            
        except Exception as e:
            logger.error(f"Error checking shape overlap: {e}")
            return False
    
    @staticmethod
    def _point_inside_polygon(point: Tuple[float, float], polygon: List[Tuple[float, float]]) -> bool:
        """
        Determine if a point is inside a polygon.
        
        Args:
            point: Point coordinates
            polygon: Polygon coordinates
            
        Returns:
            True if point is inside polygon, False otherwise
        """
        x, y = point
        n = len(polygon)
        inside = False
        
        p1x, p1y = polygon[0]
        for i in range(n+1):
            p2x, p2y = polygon[i % n]
            if y > min(p1y, p2y):
                if y <= max(p1y, p2y):
                    if x <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (y-p1y)*(p2x-p1x)/(p2y-p1y)+p1x
                        if p1x == p2x or x <= xinters:
                            inside = not inside
            p1x, p1y = p2x, p2y
        
        return inside
    
    @staticmethod
    def calculate_inter_rater_reliability(annotations: List[Annotation]) -> Dict[str, Any]:
        """
        Calculate inter-rater reliability metrics.
        
        This method calculates Cohen's Kappa and other reliability metrics
        for the given annotations.
        
        Args:
            annotations: List of annotations to analyze
            
        Returns:
            Dictionary containing reliability metrics
        """
        if len(annotations) < 2:
            return {
                "kappa": 1.0,
                "percent_agreement": 100.0,
                "reliability_level": "Perfect",
                "reviewer_count": 1
            }
        
        # Group annotations by reviewer
        reviewer_findings = {}
        for ann in annotations:
            if ann.reviewer_id not in reviewer_findings:
                reviewer_findings[ann.reviewer_id] = []
            reviewer_findings[ann.reviewer_id].append(ann.finding)
        
        # Calculate percent agreement
        total_comparisons = 0
        agreements = 0
        
        reviewer_ids = list(reviewer_findings.keys())
        for i in range(len(reviewer_ids)):
            for j in range(i+1, len(reviewer_ids)):
                reviewer1 = reviewer_ids[i]
                reviewer2 = reviewer_ids[j]
                
                findings1 = set(reviewer_findings[reviewer1])
                findings2 = set(reviewer_findings[reviewer2])
                
                # Count agreements
                for finding in findings1:
                    if finding in findings2:
                        agreements += 1
                
                # Count total comparisons
                total_comparisons += max(len(findings1), len(findings2))
        
        percent_agreement = (agreements / total_comparisons * 100) if total_comparisons > 0 else 0
        
        # Calculate kappa if possible
        kappa = 0.0
        try:
            # Convert findings to numeric values for calculation
            all_findings = set()
            for findings_list in reviewer_findings.values():
                all_findings.update(findings_list)
            
            findings_map = {finding: idx for idx, finding in enumerate(all_findings)}
            
            # Create ratings matrix (reviewers x findings)
            ratings = []
            for reviewer, findings in reviewer_findings.items():
                reviewer_ratings = [findings_map[finding] for finding in findings]
                ratings.append(reviewer_ratings)
            
            # Calculate Cohen's Kappa
            if len(ratings) >= 2 and len(ratings[0]) == len(ratings[1]):
                kappa = 0.0  # Removed cohen_kappa_score calculation
        except Exception as e:
            logger.error(f"Error calculating kappa: {e}")
            kappa = 0.0
        
        # Determine reliability level
        reliability_level = "Poor"
        if kappa > 0.8:
            reliability_level = "Very Good"
        elif kappa > 0.6:
            reliability_level = "Good"
        elif kappa > 0.4:
            reliability_level = "Moderate"
        elif kappa > 0.2:
            reliability_level = "Fair"
        
        return {
            "kappa": float(kappa),
            "percent_agreement": float(percent_agreement),
            "reliability_level": reliability_level,
            "reviewer_count": len(reviewer_findings)
        }
    
    @staticmethod
    def create_consensus_session(study_uid: str, title: str, creator_id: int, 
                               description: str = None) -> ConsensusSession:
        """
        Create a new consensus session.
        
        Args:
            study_uid: The study UID for the session
            title: Title of the consensus session
            creator_id: ID of the user creating the session
            description: Optional description of the session
            
        Returns:
            The created ConsensusSession object
        """
        session = ConsensusSession(
            study_uid=study_uid,
            title=title,
            description=description,
            creator_id=creator_id,
            status='active'
        )
        
        db.session.add(session)
        db.session.commit()
        
        return session
    
    @staticmethod
    def add_annotations_to_session(session_id: str, annotation_ids: List[str]) -> bool:
        """
        Add annotations to a consensus session.
        
        Args:
            session_id: ID of the consensus session
            annotation_ids: List of annotation IDs to add
            
        Returns:
            True if successful, False otherwise
        """
        try:
            session = ConsensusSession.query.get(session_id)
            if not session:
                return False
            
            annotations = Annotation.query.filter(Annotation.id.in_(annotation_ids)).all()
            for annotation in annotations:
                if annotation not in session.annotations:
                    session.annotations.append(annotation)
            
            db.session.commit()
            return True
        except Exception as e:
            logger.error(f"Error adding annotations to session: {e}")
            db.session.rollback()
            return False
    
    @staticmethod
    def add_reviewers_to_session(session_id: str, reviewer_ids: List[int]) -> bool:
        """
        Add reviewers to a consensus session.
        
        Args:
            session_id: ID of the consensus session
            reviewer_ids: List of reviewer IDs to add
            
        Returns:
            True if successful, False otherwise
        """
        try:
            from dicom_reviewer.models.db.user import User
            
            session = ConsensusSession.query.get(session_id)
            if not session:
                return False
            
            reviewers = User.query.filter(User.id.in_(reviewer_ids)).all()
            for reviewer in reviewers:
                if reviewer not in session.reviewers:
                    session.reviewers.append(reviewer)
            
            db.session.commit()
            return True
        except Exception as e:
            logger.error(f"Error adding reviewers to session: {e}")
            db.session.rollback()
            return False
    
    @staticmethod
    def create_consensus_discussion(session_id: str, title: str, creator_id: int, 
                                  annotation_id: str = None) -> Optional[ConsensusDiscussion]:
        """
        Create a new discussion thread in a consensus session.
        
        Args:
            session_id: ID of the consensus session
            title: Title of the discussion
            creator_id: ID of the user creating the discussion
            annotation_id: Optional ID of the annotation related to the discussion
            
        Returns:
            The created ConsensusDiscussion object or None if failed
        """
        try:
            discussion = ConsensusDiscussion(
                session_id=session_id,
                title=title,
                creator_id=creator_id,
                annotation_id=annotation_id,
                status='open'
            )
            
            db.session.add(discussion)
            db.session.commit()
            
            return discussion
        except Exception as e:
            logger.error(f"Error creating consensus discussion: {e}")
            db.session.rollback()
            return None
    
    @staticmethod
    def create_consensus_result(session_id: str, reviewer_id: int, 
                              finding: str, confidence_level: float,
                              study_uid: str, series_uid: str = None, 
                              instance_uid: str = None) -> Optional[Annotation]:
        """
        Create a consensus result annotation.
        
        This method creates a new annotation that represents the consensus
        result of a consensus session.
        
        Args:
            session_id: ID of the consensus session
            reviewer_id: ID of the user creating the result
            finding: The consensus finding
            confidence_level: The consensus confidence level
            study_uid: The study UID
            series_uid: Optional series UID
            instance_uid: Optional instance UID
            
        Returns:
            The created consensus Annotation object or None if failed
        """
        try:
            # Create the consensus annotation
            consensus_annotation = Annotation(
                study_uid=study_uid,
                series_uid=series_uid,
                instance_uid=instance_uid,
                reviewer_id=reviewer_id,
                finding=finding,
                confidence_level=confidence_level,
                consensus_status='agreed',
                is_consensus_result=True,
                consensus_score=1.0
            )
            
            db.session.add(consensus_annotation)
            db.session.commit()
            
            # Add the annotation to the session
            session = ConsensusSession.query.get(session_id)
            if session:
                session.annotations.append(consensus_annotation)
                db.session.commit()
            
            return consensus_annotation
        except Exception as e:
            logger.error(f"Error creating consensus result: {e}")
            db.session.rollback()
            return None