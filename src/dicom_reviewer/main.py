from flask import Flask, jsonify, render_template, request, send_file, abort, redirect, url_for
import os
import os.path
import pydicom
from PIL import Image
import numpy as np
import io
import json
import uuid
import logging
from datetime import datetime
from dicom_reviewer.parsers.dicom_parser import DICOMParser
from dicom_reviewer.schemas.dicom_metadata import DICOMMetadata
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from dicom_reviewer.models.db import db
from dicom_reviewer.models.db.user import User, Session
from dicom_reviewer.models.db.annotation import Annotation
from dicom_reviewer.api.consensus import consensus_bp

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, template_folder='templates', static_folder='static')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')

# Use absolute path for database file
db_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), '..', '..', 'dicom_reviewer.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# DICOM file directory
DICOM_DIR = '/home/mogadaphy/dicom-research/dicom-files'

# Initialize the database
db.init_app(app)

# Initialize login manager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Register blueprints
app.register_blueprint(consensus_bp)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Explicit database initialization function
def initialize_database(app):
    try:
        logger.info(f"Creating database at {db_path}")
        with app.app_context():
            db.create_all()
            logger.info("Database tables created successfully")
            
            # Run consensus tables migration
            try:
                from dicom_reviewer.models.db.migrations.create_consensus_tables import create_consensus_tables
                if create_consensus_tables():
                    logger.info("Consensus tables created successfully")
                else:
                    logger.warning("Failed to create consensus tables")
            except Exception as e:
                logger.error(f"Error creating consensus tables: {e}")
            
            # Run annotations table update migration
            try:
                from dicom_reviewer.models.db.migrations.update_annotations_table import update_annotations_table
                if update_annotations_table():
                    logger.info("Annotations table updated successfully")
                else:
                    logger.warning("Failed to update annotations table")
            except Exception as e:
                logger.error(f"Error updating annotations table: {e}")
            
            # Create default users if they don't exist
            if User.query.count() == 0:
                logger.info("Creating default users")
                admin = User(
                    username='admin',
                    email='admin@example.com',
                    full_name='System Administrator',
                    role='admin'
                )
                admin.set_password('admin')
                db.session.add(admin)
                
                radiologist = User(
                    username='radiologist1',
                    email='radiologist1@example.com',
                    full_name='Test Radiologist',
                    role='radiologist'
                )
                radiologist.set_password('password')
                db.session.add(radiologist)
                
                db.session.commit()
                logger.info("Default users created")
            else:
                logger.info("Default users already exist")
                
            # Log the number of existing annotations
            annotation_count = Annotation.query.count()
            logger.info(f"Found {annotation_count} existing annotations in the database")
                
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise

# Call the initialization function before starting the app
logger.info("Initializing application")
initialize_database(app)
logger.info("Application initialized successfully")

@app.route('/')
def hello_world():
    if current_user.is_authenticated:
        return redirect(url_for('dicom_list'))
    return render_template('welcome.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dicom_list'))
        
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        remember = 'remember' in request.form
        
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password):
            login_user(user, remember=remember)
            user.last_login = datetime.utcnow()
            db.session.commit()
            
            next_page = request.args.get('next')
            return redirect(next_page or url_for('dicom_list'))
        else:
            return render_template('login.html', error='Invalid username or password')
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('dicom_list'))
        
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        full_name = request.form.get('full_name')
        
        # Validate inputs
        if not username or not email or not password or not full_name:
            return render_template('register.html', error='All fields are required')
            
        if password != confirm_password:
            return render_template('register.html', error='Passwords do not match')
            
        if User.query.filter_by(username=username).first():
            return render_template('register.html', error='Username already exists')
            
        if User.query.filter_by(email=email).first():
            return render_template('register.html', error='Email already exists')
        
        # Create new user
        user = User(
            username=username,
            email=email,
            full_name=full_name,
            role='radiologist'  # Default role
        )
        user.set_password(password)
        
        db.session.add(user)
        db.session.commit()
        
        # Log the user in
        login_user(user)
        
        return redirect(url_for('dicom_list'))
    
    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/profile')
@login_required
def profile():
    # Count user's annotations
    annotation_count = Annotation.query.filter_by(reviewer_id=current_user.id).count()
    
    # Get unique studies with annotations
    studies_with_annotations = db.session.query(Annotation.study_uid).filter_by(
        reviewer_id=current_user.id
    ).distinct().count()
    
    return render_template('profile.html', 
                          annotation_count=annotation_count,
                          study_count=studies_with_annotations)

@app.route('/parse_dicom')
@login_required
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
@login_required
def dicom_list():
    return render_template('dicom_list.html')

@app.route('/viewer')
@login_required
def viewer():
    study_uid = request.args.get('studyUid')
    
    if not study_uid:
        return "Study UID is required", 400
        
    return render_template('viewer.html')

@app.route('/annotate')
@login_required
def annotate_viewer_query():
    study_uid = request.args.get('studyUid')
    
    if not study_uid:
        return "Study UID is required", 400
        
    return render_template('viewer.html')

@app.route('/annotate/<study_uid>')
@login_required
def annotate_viewer(study_uid):
    return render_template('annotate.html', study_uid=study_uid)

@app.route('/consensus')
@login_required
def consensus_dashboard():
    return render_template('consensus.html')

@app.route('/consensus/dashboard')
@login_required
def consensus_dashboard_page():
    """
    Render the consensus dashboard page.
    This page displays studies with multiple reviews for comparison.
    """
    return render_template('consensus_dashboard.html')

@app.route('/api/studies/multi-review')
@login_required
def list_multi_review_studies():
    """
    List all studies that have annotations from multiple reviewers.
    This endpoint is used for the Consensus Dashboard.
    """
    try:
        # Query for studies with annotations from multiple reviewers
        query = db.session.query(
            Annotation.study_uid,
            db.func.count(db.distinct(Annotation.reviewer_id)).label('reviewer_count'),
            db.func.count(Annotation.id).label('annotation_count')
        ).group_by(
            Annotation.study_uid
        ).having(
            db.func.count(db.distinct(Annotation.reviewer_id)) > 1
        ).order_by(
            db.desc('reviewer_count'),
            db.desc('annotation_count')
        )
        
        studies = query.all()
        
        # Format the results
        result = []
        for study in studies:
            study_uid = study.study_uid
            
            # Get the patient ID for this study
            patient_id = "Unknown"
            patient_name = "Unknown"
            study_date = "Unknown"
            
            # Search for DICOM files in the entire DICOM_DIR
            for root, _, files in os.walk(DICOM_DIR):
                for file in files:
                    if file.endswith('.dcm'):
                        file_path = os.path.join(root, file)
                        try:
                            ds = pydicom.dcmread(file_path)
                            if hasattr(ds, 'StudyInstanceUID') and ds.StudyInstanceUID == study_uid:
                                if hasattr(ds, 'PatientID'):
                                    patient_id = ds.PatientID
                                if hasattr(ds, 'PatientName'):
                                    patient_name = str(ds.PatientName)
                                if hasattr(ds, 'StudyDate'):
                                    study_date = ds.StudyDate
                                break
                        except Exception as e:
                            app.logger.error(f"Error reading DICOM file {file_path}: {str(e)}")
                            continue
                if patient_id != "Unknown":
                    break
            
            # Get the reviewers for this study
            reviewers_query = db.session.query(User.username).join(
                Annotation, Annotation.reviewer_id == User.id
            ).filter(
                Annotation.study_uid == study_uid
            ).distinct()
            
            reviewer_names = [r[0] for r in reviewers_query.all()]
            
            result.append({
                'studyUid': study_uid,
                'patientId': patient_id,
                'patientName': patient_name,
                'studyDate': study_date,
                'reviewerCount': study.reviewer_count,
                'annotationCount': study.annotation_count,
                'reviewers': reviewer_names
            })
        
        return jsonify(result)
    except Exception as e:
        app.logger.error(f"Error listing multi-review studies: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/dicom/<study_uid>/metadata', methods=['GET'])
@login_required
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
@login_required
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
@login_required
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
@login_required
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
@login_required
def create_annotation():
    try:
        data = request.json
        logger.info(f"Received annotation request with {len(data.get('shapes', []))} shapes")
        
        # Get study ID
        study_uid = data.get('studyUid')
        
        if not study_uid:
            return jsonify({"error": "Study UID is required"}), 400
            
        # Check if this is an update to an existing annotation
        annotation_id = data.get('id')
        if annotation_id:
            # Look for existing annotation
            annotation = Annotation.query.filter_by(id=annotation_id).first()
            
            # Verify ownership
            if annotation and annotation.reviewer_id != current_user.id:
                return jsonify({"error": "You can only update your own annotations"}), 403
                
            if annotation:
                # Update existing annotation
                logger.info(f"Updating existing annotation {annotation_id}")
                annotation.study_uid = study_uid
                annotation.series_uid = data.get('seriesUid')
                annotation.instance_uid = data.get('instanceUid')
                annotation.finding = data.get('finding')
                annotation.confidence_level = data.get('confidence', 0.0)  # Updated field name
                annotation.notes = data.get('notes')
                annotation.region_data = data.get('shapes')  # Updated field name
                annotation.updated_at = datetime.utcnow()
            else:
                # Create new annotation with specified ID
                logger.info(f"Creating new annotation with specified ID {annotation_id}")
                annotation = Annotation.from_dict(data, reviewer_id=current_user.id)
        else:
            # Create new annotation
            logger.info("Creating new annotation with generated ID")
            annotation = Annotation.from_dict(data, reviewer_id=current_user.id)
        
        # Save to database
        db.session.add(annotation)
        db.session.commit()
        logger.info(f"Annotation saved successfully with ID {annotation.id}")
        
        # Return the full annotation data to ensure frontend has correct structure
        return jsonify({"success": True, "id": annotation.id, "annotation": annotation.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating annotation: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/annotations/<study_uid>', methods=['GET'])
@login_required
def get_study_annotations(study_uid):
    try:
        # Query based on user role
        if current_user.role == 'radiologist':
            # Radiologists can only see their own annotations
            annotations = Annotation.query.filter_by(
                study_uid=study_uid, 
                reviewer_id=current_user.id
            ).all()
            logger.info(f"Retrieved {len(annotations)} annotations for radiologist {current_user.username}")
        else:
            # Admins can see all annotations
            annotations = Annotation.query.filter_by(study_uid=study_uid).all()
            logger.info(f"Retrieved {len(annotations)} annotations for admin {current_user.username}")
        
        # Convert to dictionary format for API response
        result = [annotation.to_dict() for annotation in annotations]
        
        # Log the shape counts for debugging
        for i, ann in enumerate(result):
            logger.debug(f"Annotation {i+1}: {len(ann.get('shapes', []))} shapes")
            
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting annotations: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/annotations/<study_uid>/<annotation_id>', methods=['DELETE'])
@login_required
def delete_annotation(study_uid, annotation_id):
    try:
        # Find the annotation
        annotation = Annotation.query.filter_by(
            id=annotation_id,
            study_uid=study_uid
        ).first()
        
        if not annotation:
            return jsonify({"error": "Annotation not found"}), 404
            
        # Check if the user owns this annotation
        if annotation.reviewer_id != current_user.id:
            return jsonify({"error": "You can only delete your own annotations"}), 403
        
        # Remove the annotation
        db.session.delete(annotation)
        db.session.commit()
        
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting annotation: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/dicom/studies', methods=['GET'])
@login_required
def get_dicom_studies():
    """
    Get a list of all available DICOM studies.
    """
    try:
        # Get unique study UIDs from the DICOM directory
        studies = []
        for study_dir in os.listdir(DICOM_DIR):
            study_path = os.path.join(DICOM_DIR, study_dir)
            if os.path.isdir(study_path):
                # Get basic metadata for the study
                study_metadata = {
                    'studyUid': study_dir,
                    'patientName': 'Unknown',  # This would be populated from actual DICOM metadata
                    'studyDate': 'Unknown',    # This would be populated from actual DICOM metadata
                    'modality': 'Unknown',     # This would be populated from actual DICOM metadata
                    'annotationCount': Annotation.query.filter_by(study_uid=study_dir).count()
                }
                
                # Try to get more metadata from the first DICOM file
                for root, _, files in os.walk(study_path):
                    for file in files:
                        if file.endswith('.dcm'):
                            try:
                                dcm_path = os.path.join(root, file)
                                ds = pydicom.dcmread(dcm_path)
                                if hasattr(ds, 'PatientName'):
                                    study_metadata['patientName'] = str(ds.PatientName)
                                if hasattr(ds, 'StudyDate'):
                                    study_metadata['studyDate'] = str(ds.StudyDate)
                                if hasattr(ds, 'Modality'):
                                    study_metadata['modality'] = str(ds.Modality)
                                break
                            except Exception as e:
                                logger.warning(f"Error reading DICOM metadata: {e}")
                
                studies.append(study_metadata)
        
        return jsonify(studies)
    except Exception as e:
        logger.error(f"Error getting DICOM studies: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/users', methods=['GET'])
@login_required
def get_users():
    """
    Get a list of all users who can be added as reviewers.
    """
    try:
        users = User.query.all()
        return jsonify([{
            'id': user.id,
            'username': user.username,
            'fullName': user.full_name,
            'role': user.role
        } for user in users])
    except Exception as e:
        logger.error(f"Error getting users: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/consensus/studies', methods=['GET'])
@login_required
def list_consensus_studies():
    """
    List all studies that have annotations from multiple reviewers.
    This endpoint is used for the Consensus Dashboard.
    """
    try:
        # Query for studies with annotations from multiple reviewers
        query = db.session.query(
            Annotation.study_uid,
            db.func.count(db.distinct(Annotation.reviewer_id)).label('reviewer_count'),
            db.func.count(Annotation.id).label('annotation_count')
        ).group_by(
            Annotation.study_uid
        ).having(
            db.func.count(db.distinct(Annotation.reviewer_id)) > 1
        ).order_by(
            db.desc('reviewer_count'),
            db.desc('annotation_count')
        )
        
        studies = query.all()
        
        # Format the results
        result = []
        for study in studies:
            study_uid = study.study_uid
            
            # Get the patient ID for this study
            patient_id = "Unknown"
            patient_name = "Unknown"
            study_date = "Unknown"
            
            # Search for DICOM files in the entire DICOM_DIR
            for root, _, files in os.walk(DICOM_DIR):
                for file in files:
                    if file.endswith('.dcm'):
                        file_path = os.path.join(root, file)
                        try:
                            ds = pydicom.dcmread(file_path)
                            if hasattr(ds, 'StudyInstanceUID') and ds.StudyInstanceUID == study_uid:
                                if hasattr(ds, 'PatientID'):
                                    patient_id = ds.PatientID
                                if hasattr(ds, 'PatientName'):
                                    patient_name = str(ds.PatientName)
                                if hasattr(ds, 'StudyDate'):
                                    study_date = ds.StudyDate
                                break
                        except Exception as e:
                            app.logger.error(f"Error reading DICOM file {file_path}: {str(e)}")
                            continue
                if patient_id != "Unknown":
                    break
            
            # Check if there's an existing consensus session for this study
            consensus_sessions = ConsensusSession.query.filter_by(study_uid=study_uid).all()
            
            result.append({
                'studyUid': study_uid,
                'patientId': patient_id,
                'patientName': patient_name,
                'studyDate': study_date,
                'reviewerCount': study.reviewer_count,
                'annotationCount': study.annotation_count,
                'hasConsensusSession': len(consensus_sessions) > 0,
                'consensusSessions': [session.to_dict() for session in consensus_sessions]
            })
        
        return jsonify(result)
    except Exception as e:
        app.logger.error(f"Error listing consensus studies: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/consensus/viewer/<study_uid>')
@login_required
def consensus_viewer(study_uid):
    """
    Render the consensus viewer page for a specific study.
    This page allows comparing annotations from different reviewers.
    """
    return render_template('consensus_viewer.html', study_uid=study_uid)

@app.route('/api/studies/<study_uid>/annotations/by-reviewer', methods=['GET'])
@login_required
def get_study_annotations_by_reviewer(study_uid):
    """
    Get all annotations for a study, grouped by reviewer.
    This endpoint is used for the Consensus Viewer.
    """
    try:
        # Get all annotations for this study
        annotations = Annotation.query.filter_by(study_uid=study_uid).all()
        
        if not annotations:
            return jsonify([]), 404
        
        # Group annotations by reviewer
        reviewer_annotations = {}
        for annotation in annotations:
            reviewer_id = annotation.reviewer_id
            
            # Get reviewer username
            reviewer = User.query.get(reviewer_id)
            reviewer_name = reviewer.username if reviewer else f"User {reviewer_id}"
            
            if reviewer_name not in reviewer_annotations:
                reviewer_annotations[reviewer_name] = {
                    'reviewerId': reviewer_id,
                    'reviewerName': reviewer_name,
                    'annotations': []
                }
            
            reviewer_annotations[reviewer_name]['annotations'].append(annotation.to_dict())
        
        # Convert to list for JSON response
        result = list(reviewer_annotations.values())
        
        return jsonify(result)
    except Exception as e:
        app.logger.error(f"Error getting annotations by reviewer: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)