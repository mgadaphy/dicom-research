from dataclasses import dataclass
from typing import Optional, Dict, Any

@dataclass
class DICOMMetadata:
    """
    Structured representation of DICOM file metadata
    """
    study_instance_uid: str
    patient_id: str
    patient_name: Optional[str] = None
    patient_age: Optional[str] = None
    patient_sex: Optional[str] = None
    modality: Optional[str] = None
    study_date: Optional[str] = None
    series_description: Optional[str] = None
    
    @classmethod
    def from_pydicom(cls, dataset):
        """
        Convert pydicom dataset to DICOMMetadata
        """
        return cls(
            study_instance_uid=str(dataset.get('StudyInstanceUID', 'Unknown')),
            patient_id=str(dataset.get('PatientID', 'Unknown')),
            patient_name=str(dataset.get('PatientName', 'Unknown')),
            patient_age=str(dataset.get('PatientAge', 'Unknown')),
            patient_sex=str(dataset.get('PatientSex', 'Unknown')),
            modality=str(dataset.get('Modality', 'Unknown')),
            study_date=str(dataset.get('StudyDate', 'Unknown')),
            series_description=str(dataset.get('SeriesDescription', 'Unknown'))
        )