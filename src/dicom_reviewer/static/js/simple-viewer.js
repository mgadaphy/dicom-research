document.addEventListener('DOMContentLoaded', function() {
    console.log("Simple DICOM viewer initializing");
    
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const studyUid = urlParams.get('studyUid');
    
    if (!studyUid) {
        alert('No study UID provided. Please select a study from the list.');
        return;
    }
    
    // Load study metadata
    fetch(`/api/dicom/${studyUid}/metadata`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load study metadata');
            }
            return response.json();
        })
        .then(metadata => {
            console.log("Study metadata:", metadata);
            
            // Update study info
            document.getElementById('patient-id').textContent = metadata.patientId || 'N/A';
            document.getElementById('patient-name').textContent = metadata.patientName || 'N/A';
            document.getElementById('study-date').textContent = metadata.studyDate || 'N/A';
            document.getElementById('modality').textContent = metadata.modality || 'N/A';
            document.getElementById('series-description').textContent = metadata.seriesDescription || 'N/A';
            
            // Load the image preview
            const previewImg = document.getElementById('dicom-preview');
            previewImg.src = `/api/dicom/${studyUid}/preview`;
            previewImg.onload = function() {
                console.log("Image preview loaded successfully");
            };
            previewImg.onerror = function() {
                console.error("Failed to load image preview");
                alert("Failed to load DICOM image preview");
            };
        })
        .catch(error => {
            console.error("Error:", error);
            alert(`Error: ${error.message}`);
        });
    
    // Basic zoom controls
    let currentScale = 1.0;
    const previewImg = document.getElementById('dicom-preview');
    
    document.getElementById('zoom-in').addEventListener('click', function() {
        currentScale += 0.1;
        previewImg.style.transform = `scale(${currentScale})`;
    });
    
    document.getElementById('zoom-out').addEventListener('click', function() {
        currentScale = Math.max(0.1, currentScale - 0.1);
        previewImg.style.transform = `scale(${currentScale})`;
    });
    
    document.getElementById('reset-view').addEventListener('click', function() {
        currentScale = 1.0;
        previewImg.style.transform = 'scale(1.0)';
    });
    
    // Window level controls (for demonstration, doesn't actually affect the image)
    document.getElementById('window-width').addEventListener('input', function() {
        console.log("Window width adjustment would happen here:", this.value);
    });
    
    document.getElementById('window-center').addEventListener('input', function() {
        console.log("Window center adjustment would happen here:", this.value);
    });
});