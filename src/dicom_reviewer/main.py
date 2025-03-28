from flask import Flask, jsonify, render_template
from src.dicom_reviewer.parsers.dicom_parser import DICOMParser

app = Flask(__name__, template_folder='templates')

@app.route('/')
def hello_world():
    return 'Multi-Reviewer DICOM System - Development Environment'

@app.route('/parse_dicom')
def parse_dicom_directory():
    # Use your actual DICOM files directory
    dicom_dir = '/home/mogadaphy/dicom-research/dicom-files'
    
    try:
        # Parse DICOM directory
        metadata_list = DICOMParser.parse_dicom_directory(dicom_dir)
        
        # Convert to JSON serializable format
        result = [
            {
                'study_instance_uid': meta.study_instance_uid,
                'patient_id': meta.patient_id,
                'patient_name': meta.patient_name,
                'modality': meta.modality,
                'study_date': meta.study_date,
                'series_description': meta.series_description
            } for meta in metadata_list
        ]
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/dicom_list')
def dicom_list():
    return render_template('dicom_list.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)