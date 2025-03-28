import os
import pydicom
from typing import List, Optional
from ..schemas.dicom_metadata import DICOMMetadata

class DICOMParser:
    @staticmethod
    def parse_dicom_file(file_path: str) -> Optional[DICOMMetadata]:
        """
        Parse a single DICOM file and extract metadata
        """
        try:
            # Read DICOM file
            dicom_dataset = pydicom.dcmread(file_path)
            
            # Convert to metadata
            return DICOMMetadata.from_pydicom(dicom_dataset)
        except Exception as e:
            print(f"Error parsing DICOM file {file_path}: {e}")
            return None
    
    @classmethod
    def parse_dicom_directory(cls, directory_path: str) -> List[DICOMMetadata]:
        """
        Parse all DICOM files in a given directory
        """
        dicom_metadata_list = []
        
        # Walk through directory
        for root, _, files in os.walk(directory_path):
            for file in files:
                file_path = os.path.join(root, file)
                
                # Check if file is a DICOM file
                try:
                    if pydicom.misc.is_dicom(file_path):
                        metadata = cls.parse_dicom_file(file_path)
                        if metadata:
                            dicom_metadata_list.append(metadata)
                except Exception:
                    # Skip non-DICOM files
                    continue
        
        return dicom_metadata_list