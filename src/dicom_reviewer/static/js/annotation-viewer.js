document.addEventListener('DOMContentLoaded', function() {
    // State variables
    let currentTool = null;
    let isDrawing = false;
    let startX = 0;
    let startY = 0;
    let annotations = [];
    let tempAnnotation = null;
    let studyUid = null;
    let reviewerId = 'reviewer1'; // This would come from authentication in a real system
    
    // References to DOM elements
    const dicomPreview = document.getElementById('dicom-preview');
    const canvas = document.getElementById('annotation-canvas');
    const ctx = canvas.getContext('2d');
    
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    studyUid = urlParams.get('studyUid');
    
    if (!studyUid) {
        alert('No study UID provided. Please select a study from the list.');
        return;
    }
    
    // Load study metadata and image
    loadStudy(studyUid);
    
    // Load existing annotations
    loadAnnotations(studyUid);
    
    // Tool selection
    const toolButtons = document.querySelectorAll('.tool-button');
    toolButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Deactivate all tools
            toolButtons.forEach(btn => btn.classList.remove('active'));
            
            // Activate selected tool
            this.classList.add('active');
            currentTool = this.id.replace('tool-', '');
            
            // Enable drawing mode
            canvas.classList.add('drawing');
        });
    });
    
    // Canvas drawing events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDrawing);
    canvas.addEventListener('mouseout', cancelDrawing);
    
    // Annotation form events
    document.getElementById('save-annotation').addEventListener('click', saveAnnotation);
    document.getElementById('cancel-annotation').addEventListener('click', cancelAnnotation);
    document.getElementById('confidence').addEventListener('input', updateConfidenceValue);
    document.getElementById('refresh-annotations').addEventListener('click', () => loadAnnotations(studyUid));
    
    // Basic zoom controls
    let currentScale = 1.0;
    
    document.getElementById('zoom-in').addEventListener('click', function() {
        currentScale += 0.1;
        applyZoom();
    });
    
    document.getElementById('zoom-out').addEventListener('click', function() {
        currentScale = Math.max(0.1, currentScale - 0.1);
        applyZoom();
    });
    
    document.getElementById('reset-view').addEventListener('click', function() {
        currentScale = 1.0;
        applyZoom();
    });
    
    function applyZoom() {
        dicomPreview.style.transform = `scale(${currentScale})`;
        canvas.style.transform = `scale(${currentScale})`;
    }
    
    // Functions
    function loadStudy(studyUid) {
        // Load metadata
        fetch(`/api/dicom/${studyUid}/metadata`)
            .then(response => {
                if (!response.ok) throw new Error('Failed to load metadata');
                return response.json();
            })
            .then(metadata => {
                updateStudyInfo(metadata);
                
                // Load image
                dicomPreview.src = `/api/dicom/${studyUid}/preview`;
                dicomPreview.onload = function() {
                    console.log("Image loaded, setting up canvas");
                    setupCanvas();
                };
            })
            .catch(error => {
                console.error("Error loading study:", error);
                alert(`Error: ${error.message}`);
            });
    }
    
    function updateStudyInfo(metadata) {
        document.getElementById('patient-id').textContent = metadata.patientId || 'N/A';
        document.getElementById('patient-name').textContent = metadata.patientName || 'N/A';
        document.getElementById('study-date').textContent = metadata.studyDate || 'N/A';
        document.getElementById('modality').textContent = metadata.modality || 'N/A';
        document.getElementById('series-description').textContent = metadata.seriesDescription || 'N/A';
    }
    
    function setupCanvas() {
        // Set canvas size to match the image
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        
        // Redraw existing annotations
        drawAnnotations();
    }
    
    function startDrawing(e) {
        if (!currentTool) return;
        
        isDrawing = true;
        
        // Get mouse position relative to canvas
        const rect = canvas.getBoundingClientRect();
        startX = (e.clientX - rect.left) / currentScale;
        startY = (e.clientY - rect.top) / currentScale;
        
        // Create temporary annotation
        tempAnnotation = {
            tool: currentTool,
            color: document.getElementById('annotation-color').value,
            width: document.getElementById('annotation-width').value,
            startX: startX,
            startY: startY,
            endX: startX,
            endY: startY
        };
    }
    
    function draw(e) {
        if (!isDrawing || !tempAnnotation) return;
        
        // Get current mouse position
        const rect = canvas.getBoundingClientRect();
        const currentX = (e.clientX - rect.left) / currentScale;
        const currentY = (e.clientY - rect.top) / currentScale;
        
        // Update temporary annotation
        tempAnnotation.endX = currentX;
        tempAnnotation.endY = currentY;
        
        // Redraw
        drawAnnotations();
    }
    
    function endDrawing() {
        if (!isDrawing || !tempAnnotation) return;
        
        isDrawing = false;
        
        // If it's just a click (no movement), ignore
        if (Math.abs(tempAnnotation.endX - tempAnnotation.startX) < 5 && 
            Math.abs(tempAnnotation.endY - tempAnnotation.startY) < 5) {
            tempAnnotation = null;
            return;
        }
        
        // Show annotation form
        document.getElementById('annotation-form').style.display = 'block';
    }
    
    function cancelDrawing() {
        isDrawing = false;
        // Keep the temporary annotation for the form
    }
    
    function saveAnnotation() {
        const finding = document.getElementById('finding').value;
        const confidence = document.getElementById('confidence').value;
        const notes = document.getElementById('notes').value;
        
        if (!finding) {
            alert('Please enter a finding description');
            return;
        }
        
        // Add metadata to the annotation
        const annotation = {
            ...tempAnnotation,
            id: Date.now().toString(),
            studyUid: studyUid,
            reviewerId: reviewerId,
            finding: finding,
            confidence: confidence,
            notes: notes,
            timestamp: new Date().toISOString()
        };
        
        // Send to server
        fetch('/api/annotations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(annotation),
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to save annotation');
            return response.json();
        })
        .then(data => {
            // Add to local collection
            annotations.push(annotation);
            
            // Reset form and temp annotation
            tempAnnotation = null;
            document.getElementById('annotation-form').style.display = 'none';
            document.getElementById('finding').value = '';
            document.getElementById('confidence').value = '7';
            document.getElementById('notes').value = '';
            
            // Update confidence display
            updateConfidenceValue();
            
            // Redraw annotations
            drawAnnotations();
            
            // Update annotation list
            updateAnnotationList();
            
            alert('Annotation saved successfully!');
        })
        .catch(error => {
            console.error('Error saving annotation:', error);
            alert(`Error: ${error.message}`);
        });
    }
    
    function cancelAnnotation() {
        tempAnnotation = null;
        document.getElementById('annotation-form').style.display = 'none';
        drawAnnotations();
    }
    
    function loadAnnotations(studyUid) {
        fetch(`/api/annotations/${studyUid}`)
            .then(response => {
                if (!response.ok) throw new Error('Failed to load annotations');
                return response.json();
            })
            .then(data => {
                annotations = data;
                drawAnnotations();
                updateAnnotationList();
            })
            .catch(error => {
                console.error('Error loading annotations:', error);
            });
    }
    
    function drawAnnotations() {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw existing annotations
        annotations.forEach(annotation => {
            drawAnnotation(annotation);
        });
        
        // Draw temporary annotation if exists
        if (tempAnnotation) {
            drawAnnotation(tempAnnotation);
        }
    }
    
    function drawAnnotation(annotation) {
        ctx.beginPath();
        ctx.strokeStyle = annotation.color || 'red';
        ctx.lineWidth = annotation.width || 3;
        
        switch (annotation.tool) {
            case 'rectangle':
                ctx.rect(
                    annotation.startX, 
                    annotation.startY, 
                    annotation.endX - annotation.startX, 
                    annotation.endY - annotation.startY
                );
                break;
                
            case 'circle':
                const radius = Math.sqrt(
                    Math.pow(annotation.endX - annotation.startX, 2) + 
                    Math.pow(annotation.endY - annotation.startY, 2)
                );
                ctx.arc(
                    annotation.startX, 
                    annotation.startY, 
                    radius, 
                    0, 
                    2 * Math.PI
                );
                break;
                
            case 'line':
                ctx.moveTo(annotation.startX, annotation.startY);
                ctx.lineTo(annotation.endX, annotation.endY);
                break;
                
            case 'arrow':
                // Draw line
                ctx.moveTo(annotation.startX, annotation.startY);
                ctx.lineTo(annotation.endX, annotation.endY);
                
                // Calculate arrow head
                const angle = Math.atan2(
                    annotation.endY - annotation.startY,
                    annotation.endX - annotation.startX
                );
                const headlen = 10; // Length of arrow head
                
                // Draw arrow head
                ctx.lineTo(
                    annotation.endX - headlen * Math.cos(angle - Math.PI / 6),
                    annotation.endY - headlen * Math.sin(angle - Math.PI / 6)
                );
                ctx.moveTo(annotation.endX, annotation.endY);
                ctx.lineTo(
                    annotation.endX - headlen * Math.cos(angle + Math.PI / 6),
                    annotation.endY - headlen * Math.sin(angle + Math.PI / 6)
                );
                break;
                
            case 'text':
                if (annotation.finding) {
                    ctx.font = '14px Arial';
                    ctx.fillStyle = annotation.color || 'red';
                    ctx.fillText(
                        annotation.finding,
                        annotation.startX,
                        annotation.startY
                    );
                }
                break;
        }
        
        ctx.stroke();
    }
    
    function updateAnnotationList() {
        const listElement = document.getElementById('annotation-list');
        listElement.innerHTML = '';
        
        if (annotations.length === 0) {
            listElement.innerHTML = '<p>No annotations yet.</p>';
            return;
        }
        
        annotations.forEach(annotation => {
            const item = document.createElement('div');
            item.className = 'annotation-item';
            
            item.innerHTML = `
                <h4>${annotation.finding}</h4>
                <p><strong>Tool:</strong> ${annotation.tool}</p>
                <p><strong>Confidence:</strong> ${annotation.confidence}/10</p>
                <p><strong>Notes:</strong> ${annotation.notes || 'None'}</p>
                <p><strong>Reviewer:</strong> ${annotation.reviewerId}</p>
                <p><strong>Time:</strong> ${new Date(annotation.timestamp).toLocaleString()}</p>
            `;
            
            // Add click to highlight functionality
            item.addEventListener('click', () => {
                // TODO: Highlight the annotation on the canvas
            });
            
            listElement.appendChild(item);
        });
    }
    
    function updateConfidenceValue() {
        const value = document.getElementById('confidence').value;
        document.getElementById('confidence-value').textContent = value;
    }
    
    // Handle window resize
    window.addEventListener('resize', () => {
        setupCanvas();
    });
});