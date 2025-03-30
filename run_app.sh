#!/bin/bash
# Activate the virtual environment
source venv/bin/activate

# Set the Python path to include the src directory and run the application
PYTHONPATH=$(pwd)/src python src/dicom_reviewer/main.py
