import os
import sys
import unittest

# Add the project root to the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.dicom_reviewer.parsers.dicom_parser import DICOMParser

class TestDICOMParser(unittest.TestCase):
    def test_parse_dicom_directory(self):
        dicom_dir = '/dicom-research/dicom-files'
        
        # Test that the directory exists
        self.assertTrue(os.path.exists(dicom_dir), f"DICOM directory {dicom_dir} does not exist")
        
        # Parse the directory
        metadata_list = DICOMParser.parse_dicom_directory(dicom_dir)
        
        # Check that we got some results
        self.assertTrue(len(metadata_list) > 0, "No DICOM files found in the directory")
        
        # Check that the metadata has the expected structure
        for metadata in metadata_list:
            self.assertIsNotNone(metadata.study_instance_uid)
            self.assertIsNotNone(metadata.patient_id)

if __name__ == '__main__':
    unittest.main()