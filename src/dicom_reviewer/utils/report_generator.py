from typing import List
from ..models.annotation import Annotation
from ..models.consensus_engine import ConsensusEngine

class DiagnosticReport:
    def __init__(self, study_id: str, annotations: List[Annotation]):
        self.study_id = study_id
        self.annotations = annotations
        self.consensus_analysis = ConsensusEngine.detect_discrepancies(annotations)
        self.inter_rater_reliability = ConsensusEngine.calculate_inter_rater_reliability(annotations)
    
    def generate_report(self) -> dict:
        return {
            "study_id": self.study_id,
            "total_annotations": len(self.annotations),
            "consensus_possible": self.consensus_analysis['consensus_possible'],
            "discrepancies": self.consensus_analysis['discrepancies'],
            "inter_rater_reliability": self.inter_rater_reliability
        }