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

## Installation & Setup

### Prerequisites

- Python 3.9+
- pip package manager
- Git
- SQLite (included with Python)

### Installation Steps

1. Clone the repository:
```bash
git clone https://github.com/yourusername/dicom-multi-reviewer.git
cd dicom-multi-reviewer
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

4. Update the DICOM directory path in `src/dicom_reviewer/main.py`:
```python
DICOM_DIR = '/path/to/your/dicom/files'
```

5. Run the application:
```bash
cd multi-reviewer
PYTHONPATH=$(pwd) python src/dicom_reviewer/main.py
```

6. Access the application at: http://localhost:5000

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
├── docker-compose.yml              # Docker setup
└── requirements.txt                # Python dependencies
```

### Components

#### DICOM Parser
- Extracts metadata from DICOM files
- Converts DICOM images to browser-viewable format

#### Annotation System
- Canvas-based drawing tools
- Multi-shape annotation tools (rectangle, circle, line, arrow, text)
- Annotation metadata (findings, confidence, notes)

#### User Management
- Registration and authentication
- Role-based access control
- User profile management

#### Discrepancy Detection System
- Identifies spatial discrepancies (annotations in similar locations with insufficient overlap)
- Detects classification discrepancies (same location, different findings)
- Highlights presence discrepancies (findings marked by one reviewer but not others)
- Visual indicators for different discrepancy types

#### In-Memory Data Storage
- User database (SQLite)
- Annotation storage (in-memory, reset on server restart)

## User Guide

### Viewing DICOM Images
1. Log in to the system using your credentials
2. The main page displays a list of available DICOM studies
3. Click the "View" button to open a study in the viewer
4. Use the zoom controls to adjust the image size
5. The window/level sliders allow adjustment of the image contrast

### Creating Annotations
1. Open a study by clicking "Annotate" from the main list
2. Click "New Annotation" to start a new annotation
3. Select a drawing tool (rectangle, circle, line, arrow, text)
4. Draw on the image to mark areas of interest
5. Add multiple shapes by clicking "Add Shape" and selecting tools
6. Remove shapes by clicking "Remove Shape" and then clicking on shapes
7. Add clinical findings, confidence level, and notes
8. Click "Save" to save the annotation

### Managing Annotations
- Saved annotations appear in the list on the right sidebar
- Click "Edit" on an annotation to modify it
- Click "Delete" to remove an annotation
- Only the creator of an annotation can edit or delete it

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

## Technologies Used

- **Backend:** Flask (Python web framework)
- **Database:** SQLite for user management
- **Authentication:** Flask-Login
- **Frontend:** HTML, CSS, JavaScript (vanilla)
- **DICOM Processing:** pydicom, Pillow (PIL)
- **Drawing Tools:** HTML Canvas API

## Limitations & Future Development

### Current Limitations
- Annotations are stored in-memory and lost on server restart
- Basic visualization of DICOM images (no windowing, measurements, or 3D)
- Limited to single-frame DICOM images
- No real-time collaboration between radiologists

### Planned Features

#### Consensus Dashboard Enhancements
- Discrepancy detection and highlighting
- Overlay view of annotations from multiple reviewers
- Side-by-side comparison of annotations
- Statistical analysis of inter-reviewer agreement
- Discussion threads for resolving discrepancies
- Voting mechanism for consensus building

#### Persistent Data Storage
- Database storage for annotations
- PACS integration

#### Advanced Visualization
- MPR (Multiplanar Reconstruction)
- MIP (Maximum Intensity Projection)
- Volume rendering

#### Communication Tools
- Discussion threads for specific annotations
- Notification system
- Real-time collaboration

## Development Guidelines

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## Changelog

### v0.2.0 (March 2025)
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