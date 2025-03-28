from typing import List
import numpy as np
from scipy.stats import cohen_kappa_score
from .annotation import Annotation

class ConsensusEngine:
    @staticmethod
    def detect_discrepancies(annotations: List[Annotation]) -> dict:
        """
        Detect and analyze differences in annotations
        """
        if len(annotations) < 2:
            return {"consensus_possible": True, "discrepancies": []}
        
        # Group annotations by finding
        findings = [ann.finding for ann in annotations]
        
        # Basic discrepancy detection
        unique_findings = set(findings)
        is_consensus = len(unique_findings) <= 1
        
        return {
            "consensus_possible": is_consensus,
            "discrepancies": list(unique_findings) if not is_consensus else [],
            "total_annotations": len(annotations)
        }
    
    @staticmethod
    def calculate_inter_rater_reliability(annotations: List[Annotation]) -> float:
        """
        Calculate Cohen's Kappa for inter-rater reliability
        """
        if len(annotations) < 2:
            return 1.0  # Perfect agreement if only one rater
        
        # Convert findings to numeric values for calculation
        findings_map = {finding: idx for idx, finding in enumerate(set(ann.finding for ann in annotations))}
        
        # Create numeric ratings
        ratings = [findings_map[ann.finding] for ann in annotations]
        
        return cohen_kappa_score(ratings, ratings)