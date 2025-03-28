from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

@dataclass
class Annotation:
    reviewer_id: str
    study_id: str
    timestamp: datetime = field(default_factory=datetime.now)
    region: Optional[str] = None
    finding: Optional[str] = None
    confidence_level: float = 0.0
    notes: Optional[str] = None

class AnnotationTracker:
    def __init__(self):
        self.annotations = {}
    
    def add_annotation(self, annotation: Annotation):
        """
        Add an annotation for a specific study
        """
        if annotation.study_id not in self.annotations:
            self.annotations[annotation.study_id] = []
        
        self.annotations[annotation.study_id].append(annotation)
    
    def get_annotations_for_study(self, study_id: str):
        """
        Retrieve all annotations for a specific study
        """
        return self.annotations.get(study_id, [])