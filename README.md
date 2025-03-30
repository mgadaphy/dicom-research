# DICOM Multi-Reviewer System

## Project Overview

The DICOM Multi-Reviewer System is a collaborative medical imaging platform designed to reduce diagnostic errors in radiology through consensus review. It allows multiple radiologists to independently annotate the same medical images and then identifies and resolves discrepancies in their diagnoses.

## Core Features

- **DICOM Image Viewing:** Browser-based viewing of DICOM medical images
- **Annotation Tools:** Multi-shape drawing tools for identifying and marking areas of interest
- **User Authentication:** Role-based access with separate radiologist and admin views
- **Collaborative Review:** Tools to enable multiple radiologists to review the same studies
- **Discrepancy Detection:** Automatic identification of spatial, classification, and presence discrepancies between reviewers
- **Consensus Building:** Tools to facilitate reaching consensus on discrepant findings
- **Persistent Annotations:** Annotations are saved to the database and preserved between sessions

## Installation & Setup

### Prerequisites

- Python 3.9+
- pip package manager
- Git
- SQLite (included with Python)

### DICOM Test Files

The system requires DICOM files for testing and development. We recommend using:

1. **MAGNETOM Free.Max Sample Data**: Publicly available sample DICOM files from Siemens Healthineers
2. **Orthanc Sample Files**: Anonymous DICOM files available at [orthanc-server/orthanc-setup-samples](https://github.com/orthanc-server/orthanc-setup-samples/tree/master/dicomFiles)

For proper setup, place your DICOM files in a directory named `dicom-files` in the same parent directory as the `multi-reviewer` folder:

```
dicom-research/
├── multi-reviewer/    # Main application code
└── dicom-files/       # DICOM test files
```

### Installation Steps

1. Clone the repository:
```bash
git clone https://github.com/mgadaphy/dicom-research.git
cd dicom-research/multi-reviewer
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Update the DICOM directory path in `src/dicom_reviewer/main.py` if needed:
```python
DICOM_DIR = '../dicom-files'  # Relative path to DICOM files directory
```

## Running the Application

### Development Environment

1. Navigate to the project directory:
   ```bash
   cd ~/dicom-research/multi-reviewer
   ```

2. Activate the virtual environment:
   ```bash
   source venv/bin/activate
   ```

3. Run the application:
   ```bash
   PYTHONPATH=$(pwd)/src python src/dicom_reviewer/main.py
   ```

4. Access the application in your browser at `http://localhost:5000`

### Production Environment

For production deployment, use a WSGI server like Gunicorn:

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 src.dicom_reviewer.main:app
```

### Default Accounts

Upon first startup, the system creates two default accounts:

**Admin Account**
- Username: admin
- Password: admin
- Role: Administrator (can view all annotations)

**Radiologist Account**
- Username: radiologist1
- Password: password
- Role: Radiologist (can only view/edit own annotations)

## System Architecture

### Directory Structure

```
multi-reviewer/
├── src/
│   └── dicom_reviewer/
│       ├── main.py                 # Main application entry point
│       ├── models/
│       │   ├── annotation.py       # Annotation data models
│       │   ├── consensus_engine.py # Consensus comparison logic
│       │   └── db/
│       │       ├── user.py         # User authentication models
│       │       ├── annotation.py   # Persistent annotation storage
│       │       └── consensus.py    # Consensus data models
│       ├── parsers/
│       │   └── dicom_parser.py     # DICOM file handling
│       ├── schemas/
│       │   └── dicom_metadata.py   # DICOM metadata structure
│       ├── static/
│       │   ├── css/
│       │   │   ├── viewer.css      # Viewer styling
│       │   │   └── annotation.css  # Annotation tools styling
│       │   └── js/
│       │       ├── annotation-viewer.js # Annotation tools
│       │       ├── consensus.js    # Consensus and discrepancy detection
│       │       └── simple-viewer.js     # DICOM viewer
│       └── templates/
│           ├── dicom_list.html     # DICOM file listing
│           ├── login.html          # Login page
│           ├── profile.html        # User profile page
│           ├── register.html       # Registration page
│           ├── viewer.html         # DICOM viewer and annotation page
│           └── consensus_viewer.html # Multi-reviewer consensus view
├── tests/                          # Test files
├── instance/                       # SQLite database files
├── docker-compose.yml              # Docker setup
└── requirements.txt                # Python dependencies
```

### Components

#### DICOM Parser
- Extracts metadata from DICOM files
- Converts DICOM images to browser-viewable format
- Handles various DICOM formats and manufacturers

#### Annotation System
- Canvas-based drawing tools
- Multi-shape annotation tools (rectangle, circle, line, arrow, text)
- Annotation metadata (findings, confidence, notes)
- Persistent storage of annotations in SQLite database

#### User Management
- Registration and authentication
- Role-based access control
- User profile management
- Session management

#### Discrepancy Detection System
- Identifies spatial discrepancies (annotations in similar locations with insufficient overlap)
- Detects classification discrepancies (same location, different findings)
- Highlights presence discrepancies (findings marked by one reviewer but not others)
- Visual indicators for different discrepancy types
- Configurable threshold for spatial overlap

#### Data Storage
- User database (SQLite)
- Persistent annotation storage (SQLite)
- Study and series metadata

## Project Documentation Plan

### Phase 1: Technical Documentation

1. **System Architecture Documentation**
   - Complete system architecture diagrams
   - Component interaction flowcharts
   - Database schema documentation
   - API endpoint documentation

2. **Code Documentation**
   - Add comprehensive docstrings to all Python modules, classes, and functions
   - Document JavaScript functions and components
   - Create a style guide for future code contributions
   - Add inline comments for complex algorithms

3. **Installation and Deployment Guide**
   - Detailed setup instructions for different environments (Linux, WSL, macOS)
   - Production deployment guide with security considerations
   - Troubleshooting common installation issues
   - System requirements and dependencies documentation

### Phase 2: User Documentation

1. **Administrator Guide**
   - System configuration options
   - User management procedures
   - Backup and recovery procedures
   - System monitoring and maintenance

2. **Radiologist User Guide**
   - Annotation workflow tutorial
   - Tool usage instructions with screenshots
   - Best practices for consistent annotations
   - Keyboard shortcuts and efficiency tips

3. **Consensus Review Guide**
   - Consensus workflow explanation
   - Discrepancy resolution procedures
   - Reporting and exporting results
   - Collaboration features tutorial

### Phase 3: Educational Materials

1. **Training Materials**
   - Video tutorials for common workflows
   - Interactive demos for annotation tools
   - Quick reference cards for frequently used features
   - Sample datasets for training purposes

2. **Knowledge Base**
   - FAQ section for common questions
   - Troubleshooting guides for common issues
   - Glossary of technical and medical terms
   - Best practices for DICOM annotation

### Phase 4: Development Documentation

1. **Contributor Guide**
   - Code contribution guidelines
   - Development environment setup
   - Testing procedures and guidelines
   - Pull request and code review process

2. **Extension and Plugin Documentation**
   - API documentation for third-party integrations
   - Plugin development guide
   - Custom annotation tool creation tutorial
   - Integration with external PACS systems

This documentation plan will ensure comprehensive coverage of all aspects of the DICOM Multi-Reviewer System, facilitating both user adoption and future development.

## User Guide

### Viewing DICOM Images
1. Log in to the system using your credentials
2. The main page displays a list of available DICOM studies
3. Click the "View" button to open a study in the viewer
4. Use the zoom controls to adjust the image size
5. The window/level sliders allow adjustment of the image contrast
6. Navigate between images using the Previous/Next buttons

### Creating Annotations
1. Open a study by clicking "Annotate" from the main list
2. Click "New Annotation" to start a new annotation
3. Select a drawing tool (rectangle, circle, line, arrow, text)
4. Draw on the image to mark areas of interest
5. Add multiple shapes by clicking "Add Shape" and selecting tools
6. Remove shapes by clicking "Remove Shape" and then clicking on shapes
7. Add clinical findings, confidence level, and notes
8. Click "Save" to save the annotation to the database

### Managing Annotations
- Saved annotations appear in the list on the right sidebar
- Click "Edit" on an annotation to modify it
- Click "Delete" to remove an annotation
- Only the creator of an annotation can edit or delete it
- Annotations persist between sessions and server restarts

### Consensus Review
1. Access the consensus viewer for studies with multiple reviews
2. Toggle reviewers on/off to compare different annotations
3. Click "Show Discrepancies" to highlight differences between reviewers
4. Discrepancies are color-coded by type:
   - Yellow: Spatial discrepancies (similar location, insufficient overlap)
   - Magenta: Classification discrepancies (same location, different findings)
   - Orange/Blue: Presence discrepancies (findings marked by one reviewer but not others)
5. Click "Focus" on a discrepancy to highlight it on the image
6. Toggle between "Overlay View" and "Side by Side" to compare annotations

### Administrator Functions
- Log in with the admin account
- Admin users can see annotations from all radiologists
- Radiologists can only see their own annotations
- Admins can initiate consensus reviews for studies with multiple annotations
- Access to system statistics and user management

## Future Enhancements

The following features are planned for future implementation:

### Consensus Dashboard Enhancements

1. **Side-by-Side View Implementation**
   - Display annotations from multiple reviewers in separate panels
   - Provide clear visual separation between reviewer annotations
   - Enable easy comparison of findings across reviewers

2. **Improved Discrepancy Detection**
   - Enhanced spatial analysis algorithms
   - Better handling of different annotation types
   - Configurable thresholds for different discrepancy types

3. **Consensus Building Interface**
   - Discussion threads for resolving discrepancies
   - Voting mechanism for consensus building
   - Automated consensus suggestions based on reviewer expertise

4. **Statistics and Reporting**
   - Inter-reviewer reliability metrics
   - Comprehensive reporting on discrepancies
   - Export capabilities for consensus findings

### Advanced Data Storage
- PACS integration
- Cloud storage options

### Advanced Visualization
- MPR (Multiplanar Reconstruction)
- MIP (Maximum Intensity Projection)
- Volume rendering
- Enhanced windowing controls

## Technologies Used

- **Backend:** Flask (Python web framework)
- **Database:** SQLite for user management and annotation storage
- **Authentication:** Flask-Login
- **Frontend:** HTML, CSS, JavaScript (vanilla)
- **DICOM Processing:** pydicom, Pillow (PIL)
- **Drawing Tools:** HTML Canvas API

## Limitations & Future Development

### Current Limitations
- Limited to single-frame DICOM images
- Basic visualization of DICOM images (limited windowing)
- No real-time collaboration between radiologists
- Limited support for complex DICOM formats

### Planned Features

#### Consensus Dashboard Enhancements
- ✅ Persistent annotation storage
- ✅ Discrepancy detection and highlighting
- ✅ Overlay view of annotations from multiple reviewers
- 🔄 Side-by-side comparison of annotations (in progress)
- 📅 Statistical analysis of inter-reviewer agreement
- 📅 Discussion threads for resolving discrepancies
- 📅 Voting mechanism for consensus building

#### Advanced Data Storage
- ✅ SQLite database for annotations
- 📅 PACS integration
- 📅 Cloud storage options

#### Advanced Visualization
- 📅 MPR (Multiplanar Reconstruction)
- 📅 MIP (Maximum Intensity Projection)
- 📅 Volume rendering
- 📅 Enhanced windowing controls

#### Communication Tools
- 📅 Discussion threads for specific annotations
- 📅 Notification system
- 📅 Real-time collaboration

## Development Guidelines

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## Changelog

### v0.3.0 (March 2025)
- Implemented persistent annotation storage using SQLite
- Enhanced DICOM file handling for various manufacturers
- Added support for more annotation types and metadata
- Improved user interface for annotation management
- Added database migration system

### v0.2.0 (February 2025)
- Added consensus viewer for comparing annotations from multiple reviewers
- Implemented discrepancy detection for spatial, classification, and presence differences
- Added visual highlighting of discrepancies with color-coding
- Added focus functionality to highlight specific discrepancies
- Fixed various bugs in annotation rendering and discrepancy detection

### v0.1.0 (January 2025)
- Initial release with basic DICOM viewing and annotation capabilities
- User authentication and role-based access control
- In-memory annotation storage
- Basic annotation tools (rectangle, circle, line, arrow, text)