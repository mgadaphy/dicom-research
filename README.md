# Multi-Reviewer DICOM System

A collaborative DICOM-based medical imaging platform for multiple radiologists to independently review and annotate the same study, compare interpretations, and reduce diagnostic errors through consensus.

## Project Overview

This research tool aims to address critical challenges in diagnostic accuracy by introducing a collaborative, consensus-driven approach to medical image interpretation.

### Core Problem Addressed
Medical diagnostic errors represent a significant challenge in healthcare, with studies suggesting that misdiagnoses occur in 10-20% of cases. These errors can stem from:
- Individual cognitive biases
- Limited perspective of a single radiologist
- Variations in interpretation skills
- Complex or ambiguous medical images

### Current Capabilities
- DICOM file parsing and metadata extraction
- Annotation tracking system
- Consensus comparison mechanism
- Statistical analysis for inter-rater reliability

## Project Structure
```
multi-reviewer/
├── src/
│   └── dicom_reviewer/
│       ├── main.py               # Main application entry point
│       ├── models/               # Data models
│       │   ├── annotation.py     # Annotation tracking
│       │   └── consensus_engine.py # Consensus comparison
│       ├── parsers/              # File parsers
│       │   └── dicom_parser.py   # DICOM file handling
│       ├── schemas/              # Data schemas
│       │   └── dicom_metadata.py # DICOM metadata structure
│       ├── templates/            # HTML templates
│       │   └── dicom_list.html   # DICOM file listing
│       └── utils/                # Utility functions
│           └── report_generator.py # Diagnostic report generation
├── tests/                       # Test files
│   └── test_dicom_parser.py     # Tests for DICOM parser
├── docker-compose.yml           # Docker environment setup
└── requirements.txt             # Python dependencies
```

## Current Milestone: DICOM Parsing and Metadata Display
- ✅ Development environment setup
- ✅ DICOM file parsing
- ✅ Metadata extraction and display
- ✅ Basic annotation model
- ✅ Consensus engine framework

## Next Development Phase: Annotation Interface
1. **Enhanced DICOM Viewer**
   - Create a dedicated page for viewing individual DICOM files
   - Add basic controls (zoom, pan, window/level adjustment)
   - Implement annotation tools (drawing, measurement)

2. **Annotation Storage**
   - Connect existing annotation models to the UI
   - Save annotations per reviewer
   - Implement blinded review mode

3. **Consensus Dashboard**
   - Create a view for comparing multiple reviewers' inputs
   - Implement discrepancy highlighting
   - Add statistical analysis display

## Future Phases
- Authentication system for multiple reviewers
- Advanced visualization techniques
- Machine learning integration
- Multi-institution validation

## Running the Application

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Start the application:
```bash
cd multi-reviewer
PYTHONPATH=$(pwd) python src/dicom_reviewer/main.py
```

3. Access the application:
   - Open your browser and navigate to `http://localhost:5000/dicom_list`

## Development Guidelines
- Follow PEP 8 style guide
- Write unit tests for new functionality
- Document code with docstrings