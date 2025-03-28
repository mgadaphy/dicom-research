from flask import Flask, jsonify, render_template, request, send_file, abort
import os
import pydicom
from PIL import Image
import numpy as np
import io
import json
import uuid
from datetime import datetime
from src.dicom_reviewer.parsers.dicom_parser import DICOMParser
from src.dicom_reviewer.schemas.dicom_metadata import DICOMMetadata

app = Flask(__name__, template_folder='templates', static_folder='static')

# DICOM file directory
DICOM_DIR = '/home/mogadaphy/dicom-research/dicom-files'

# Initialize an in-memory store for annotations (would be a database in production)
annotations_store = {}

@app.route('/')
def hello_world():
    return 'Multi-Reviewer DICOM System - Development Environment'

@app.route('/parse_dicom')
def parse_dicom_directory():
    try:
        # Parse DICOM directory
        metadata_list = DICOMParser.parse_dicom_directory(DICOM_DIR)
        
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

@app.route('/viewer')
def viewer():
    study_uid = request.args.get('studyUid')
    
    if not study_uid:
        return "Study UID is required", 400
        
    return render_template('viewer.html')

@app.route('/annotate')
def annotate_viewer():
    study_uid = request.args.get('studyUid')
    
    if not study_uid:
        return "Study UID is required", 400
        
    return render_template('viewer.html')

@app.route('/api/dicom/<study_uid>/metadata', methods=['GET'])
def get_study_metadata(study_uid):
    try:
        # Parse DICOM directory
        metadata_list = DICOMParser.parse_dicom_directory(DICOM_DIR)
        
        if not metadata_list:
            return jsonify({"error": "No DICOM files found"}), 404
        
        # Find metadata for the requested study
        study_metadata = None
        for metadata in metadata_list:
            if metadata.study_instance_uid == study_uid:
                study_metadata = metadata
                break
                
        # If not found, use the first one (fallback)
        if study_metadata is None:
            study_metadata = metadata_list[0]
            print(f"Warning: Study {study_uid} not found, using first available study")
            
        return jsonify({
            "patientId": study_metadata.patient_id,
            "patientName": study_metadata.patient_name,
            "studyDate": study_metadata.study_date,
            "modality": study_metadata.modality,
            "seriesDescription": study_metadata.series_description,
            "studyInstanceUid": study_metadata.study_instance_uid
        })
    except Exception as e:
        print(f"Error in get_study_metadata: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/dicom/<study_uid>/preview', methods=['GET'])
def get_dicom_preview(study_uid):
    try:
        # Find a DICOM file for this study
        for root, _, files in os.walk(DICOM_DIR):
            for file in files:
                file_path = os.path.join(root, file)
                try:
                    if os.path.isfile(file_path) and file.endswith('.dcm'):
                        dicom_data = pydicom.dcmread(file_path)
                        
                        # Check if this is the study we're looking for
                        if hasattr(dicom_data, 'StudyInstanceUID') and dicom_data.StudyInstanceUID == study_uid:
                            
                            # Convert DICOM to image
                            pixel_array = dicom_data.pixel_array
                            
                            # Normalize pixel values
                            if pixel_array.max() > 0:
                                pixel_array = (pixel_array / pixel_array.max() * 255).astype(np.uint8)
                            
                            # Create PIL image
                            img = Image.fromarray(pixel_array)
                            
                            # Convert to PNG and return
                            img_io = io.BytesIO()
                            img.save(img_io, 'PNG')
                            img_io.seek(0)
                            return send_file(img_io, mimetype='image/png')
                except Exception as file_error:
                    print(f"Error processing file {file_path}: {file_error}")
                    continue
        
        # If we didn't find the right study, try returning any DICOM image
        for root, _, files in os.walk(DICOM_DIR):
            for file in files:
                file_path = os.path.join(root, file)
                try:
                    if os.path.isfile(file_path) and file.endswith('.dcm'):
                        dicom_data = pydicom.dcmread(file_path)
                        
                        # Convert DICOM to image
                        pixel_array = dicom_data.pixel_array
                        
                        # Normalize pixel values
                        if pixel_array.max() > 0:
                            pixel_array = (pixel_array / pixel_array.max() * 255).astype(np.uint8)
                        
                        # Create PIL image
                        img = Image.fromarray(pixel_array)
                        
                        # Convert to PNG and return
                        img_io = io.BytesIO()
                        img.save(img_io, 'PNG')
                        img_io.seek(0)
                        return send_file(img_io, mimetype='image/png')
                except Exception as file_error:
                    print(f"Error processing file {file_path}: {file_error}")
                    continue
                
        return "No DICOM files could be converted to preview", 404
    except Exception as e:
        print(f"General error in get_dicom_preview: {e}")
        return str(e), 500

@app.route('/api/dicom/<study_uid>/<series_uid>/<instance_uid>', methods=['GET'])
def get_dicom_metadata(study_uid, series_uid, instance_uid):
    try:
        # Parse DICOM directory
        metadata_list = DICOMParser.parse_dicom_directory(DICOM_DIR)
        
        if not metadata_list:
            return jsonify({"error": "No DICOM files found"}), 404
        
        # Find metadata for the requested study
        study_metadata = None
        for metadata in metadata_list:
            if metadata.study_instance_uid == study_uid:
                study_metadata = metadata
                break
                
        # If not found, use the first one (fallback)
        if study_metadata is None:
            study_metadata = metadata_list[0]
            print(f"Warning: Study {study_uid} not found, using first available study")
            
        return jsonify({
            "patientId": study_metadata.patient_id,
            "patientName": study_metadata.patient_name,
            "studyDate": study_metadata.study_date,
            "modality": study_metadata.modality,
            "seriesDescription": study_metadata.series_description,
            "studyInstanceUid": study_metadata.study_instance_uid
        })
    except Exception as e:
        print(f"Error in get_dicom_metadata: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/dicom/<study_uid>/<series_uid>/<instance_uid>/file', methods=['GET'])
def get_dicom_file(study_uid, series_uid, instance_uid):
    try:
        # For this prototype, we'll just return the first DICOM file
        for root, _, files in os.walk(DICOM_DIR):
            for file in files:
                file_path = os.path.join(root, file)
                try:
                    # Check if it's a DICOM file
                    if os.path.isfile(file_path) and file.endswith('.dcm'):
                        # Send the file with the correct MIME type
                        return send_file(
                            file_path, 
                            mimetype='application/dicom',
                            as_attachment=False,
                            download_name=file
                        )
                except Exception as file_error:
                    print(f"Error with file {file_path}: {file_error}")
                    continue
                
        return "DICOM file not found", 404
    except Exception as e:
        print(f"General error in get_dicom_file: {e}")
        return str(e), 500

@app.route('/api/annotations', methods=['POST'])
def create_annotation():
    try:
        data = request.json
        
        # Add a unique ID if not provided
        if 'id' not in data:
            data['id'] = str(uuid.uuid4())
            
        # Add timestamp if not provided
        if 'timestamp' not in data:
            data['timestamp'] = datetime.now().isoformat()
            
        # Get study ID
        study_uid = data.get('studyUid')
        
        if not study_uid:
            return jsonify({"error": "Study UID is required"}), 400
            
        # Initialize study annotations if needed
        if study_uid not in annotations_store:
            annotations_store[study_uid] = []
            
        # Add to store
        annotations_store[study_uid].append(data)
        
        return jsonify({"success": True, "id": data['id']}), 201
    except Exception as e:
        print(f"Error creating annotation: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/annotations/<study_uid>', methods=['GET'])
def get_study_annotations(study_uid):
    try:
        # Return annotations for this study
        return jsonify(annotations_store.get(study_uid, []))
    except Exception as e:
        print(f"Error getting annotations: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)