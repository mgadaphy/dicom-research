document.addEventListener('DOMContentLoaded', function() {
    // State variables
    let currentTool = null;
    let isDrawing = false;
    let startX = 0;
    let startY = 0;
    let annotations = [];
    let currentAnnotation = null;  // The annotation being edited
    let tempShape = null;          // The shape being drawn
    let studyUid = null;
    let reviewerId = document.getElementById('current-username').value; // Get username from hidden input field
    let activeAnnotationId = null; // ID of the annotation currently being edited
    
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
    
    // Annotation management buttons
    document.getElementById('new-annotation').addEventListener('click', startNewAnnotation);
    document.getElementById('add-shape').addEventListener('click', enableShapeAddition);
    document.getElementById('remove-shape').addEventListener('click', enableShapeRemoval);
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
    
    function startNewAnnotation() {
        // Clear any previous in-progress annotation
        if (currentAnnotation) {
            const saveConfirm = confirm("Do you want to save the current annotation?");
            if (saveConfirm) {
                saveAnnotation();
            }
        }
        
        // Create a new annotation
        currentAnnotation = {
            id: Date.now().toString(),
            studyUid: studyUid,
            reviewerId: reviewerId,
            shapes: [],
            finding: '',
            confidence: 7,
            notes: '',
            timestamp: new Date().toISOString()
        };
        
        activeAnnotationId = currentAnnotation.id;
        
        // Show annotation form
        document.getElementById('annotation-form').style.display = 'block';
        document.getElementById('shape-tools').style.display = 'block';
        document.getElementById('annotation-status').textContent = 'Creating new annotation';
        
        // Enable tool selection
        enableShapeAddition();
    }
    
    function enableShapeAddition() {
        if (!currentAnnotation) {
            alert('Please start a new annotation first');
            return;
        }
        
        // Enable drawing mode and fix cursor issue
        canvas.classList.add('drawing');
        canvas.classList.remove('removing');
        
        // Update UI
        document.getElementById('add-shape').classList.add('active');
        document.getElementById('remove-shape').classList.remove('active');
        document.getElementById('annotation-status').textContent = 'Adding shapes to annotation';
        
        // Enable tools
        toolButtons.forEach(btn => btn.disabled = false);
    }
    
    function enableShapeRemoval() {
        if (!currentAnnotation || currentAnnotation.shapes.length === 0) {
            alert('No shapes to remove');
            return;
        }
        
        // Disable drawing mode
        canvas.classList.remove('drawing');
        canvas.classList.add('removing');
        
        // Update UI
        document.getElementById('add-shape').classList.remove('active');
        document.getElementById('remove-shape').classList.add('active');
        document.getElementById('annotation-status').textContent = 'Click on a shape to remove it';
        
        // Disable tools
        toolButtons.forEach(btn => btn.disabled = true);
    }
    
    function startDrawing(e) {
        if (!currentTool || !currentAnnotation || !document.getElementById('add-shape').classList.contains('active')) return;
        
        isDrawing = true;
        
        // Get mouse position relative to canvas
        const rect = canvas.getBoundingClientRect();
        startX = (e.clientX - rect.left) / currentScale;
        startY = (e.clientY - rect.top) / currentScale;
        
        // Create temporary shape
        tempShape = {
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
        if (!isDrawing || !tempShape) return;
        
        // Get current mouse position
        const rect = canvas.getBoundingClientRect();
        const currentX = (e.clientX - rect.left) / currentScale;
        const currentY = (e.clientY - rect.top) / currentScale;
        
        // Update temporary shape
        tempShape.endX = currentX;
        tempShape.endY = currentY;
        
        // Redraw
        drawAnnotations();
    }
    
    function endDrawing(e) {
        if (!isDrawing || !tempShape) return;
        
        isDrawing = false;
        
        // If it's just a click (no movement), ignore
        if (Math.abs(tempShape.endX - tempShape.startX) < 5 && 
            Math.abs(tempShape.endY - tempShape.startY) < 5) {
            tempShape = null;
            return;
        }
        
        // Add to current annotation
        currentAnnotation.shapes.push(tempShape);
        tempShape = null;
        
        // Redraw
        drawAnnotations();
        
        // Update shape count
        updateShapeCount();
    }
    
    function cancelDrawing() {
        isDrawing = false;
        // Discard the temporary shape
        tempShape = null;
        drawAnnotations();
    }
    
    function updateShapeCount() {
        const count = currentAnnotation ? currentAnnotation.shapes.length : 0;
        document.getElementById('shape-count').textContent = count.toString();
    }
    
    function saveAnnotation() {
        if (!currentAnnotation) {
            alert('No annotation to save');
            return;
        }
        
        if (currentAnnotation.shapes.length === 0) {
            alert('Please add at least one shape to the annotation');
            return;
        }
        
        // Get form values
        currentAnnotation.finding = document.getElementById('finding').value;
        currentAnnotation.confidence = document.getElementById('confidence').value;
        currentAnnotation.notes = document.getElementById('notes').value;
        
        if (!currentAnnotation.finding) {
            alert('Please enter a finding description');
            return;
        }
        
        // Send to server
        fetch('/api/annotations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(currentAnnotation),
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to save annotation');
            return response.json();
        })
        .then(data => {
            // Check if this is an update or a new annotation
            const existingIndex = annotations.findIndex(a => a.id === currentAnnotation.id);
            if (existingIndex >= 0) {
                // Update existing annotation
                annotations[existingIndex] = currentAnnotation;
            } else {
                // Add new annotation
                annotations.push(currentAnnotation);
            }
            
            // Reset current annotation
            currentAnnotation = null;
            activeAnnotationId = null;
            
            // Reset form
            document.getElementById('annotation-form').style.display = 'none';
            document.getElementById('shape-tools').style.display = 'none';
            document.getElementById('finding').value = '';
            document.getElementById('confidence').value = '7';
            document.getElementById('notes').value = '';
            updateConfidenceValue();
            
            // Disable drawing mode
            canvas.classList.remove('drawing');
            canvas.classList.remove('removing');
            
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
        // Reset current annotation
        currentAnnotation = null;
        activeAnnotationId = null;
        tempShape = null;
        
        // Reset form
        document.getElementById('annotation-form').style.display = 'none';
        document.getElementById('shape-tools').style.display = 'none';
        
        // Disable drawing mode
        canvas.classList.remove('drawing');
        canvas.classList.remove('removing');
        
        // Redraw annotations
        drawAnnotations();
    }
    
    function editAnnotation(annotationId) {
        // Find the annotation
        const annotation = annotations.find(a => a.id === annotationId);
        if (!annotation) {
            alert('Annotation not found');
            return;
        }
        
        // Set as current annotation (deep clone to avoid modifying original)
        currentAnnotation = JSON.parse(JSON.stringify(annotation));
        activeAnnotationId = annotationId;
        
        // Update form
        document.getElementById('finding').value = currentAnnotation.finding || '';
        document.getElementById('confidence').value = currentAnnotation.confidence || 7;
        document.getElementById('notes').value = currentAnnotation.notes || '';
        updateConfidenceValue();
        
        // Show form and tools
        document.getElementById('annotation-form').style.display = 'block';
        document.getElementById('shape-tools').style.display = 'block';
        document.getElementById('annotation-status').textContent = 'Editing annotation';
        
        // Update shape count
        updateShapeCount();
        
        // Default to add shape mode
        enableShapeAddition();
        
        // Highlight this annotation
        drawAnnotations();
    }
    
    function removeShape(e) {
        if (!currentAnnotation || !document.getElementById('remove-shape').classList.contains('active')) return;
        
        // Get mouse position
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) / currentScale;
        const mouseY = (e.clientY - rect.top) / currentScale;
        
        console.log("Mouse position:", mouseX, mouseY);
        console.log("Current annotation shapes:", currentAnnotation.shapes);
        
        // Find the shape under the cursor
        let shapeToRemove = -1;
        for (let i = 0; i < currentAnnotation.shapes.length; i++) {
            const shape = currentAnnotation.shapes[i];
            if (isPointInShape(mouseX, mouseY, shape)) {
                shapeToRemove = i;
                console.log("Found shape to remove at index:", i, shape);
                break;
            }
        }
        
        if (shapeToRemove >= 0) {
            console.log("Removing shape at index:", shapeToRemove);
            // Remove the shape
            currentAnnotation.shapes.splice(shapeToRemove, 1);
            
            // Redraw
            drawAnnotations();
            
            // Update shape count
            updateShapeCount();
            
            // If no shapes left, switch back to add mode
            if (currentAnnotation.shapes.length === 0) {
                enableShapeAddition();
            }
        } else {
            console.log("No shape found at position:", mouseX, mouseY);
        }
    }
    
    function isPointInShape(x, y, shape) {
        // Increase tolerance for easier selection
        const tolerance = 20; // pixels (increased from 10)
        
        // Log shape details for debugging
        console.log("Checking shape:", shape);
        
        switch (shape.tool) {
            case 'rectangle':
                const minX = Math.min(shape.startX, shape.endX) - tolerance;
                const maxX = Math.max(shape.startX, shape.endX) + tolerance;
                const minY = Math.min(shape.startY, shape.endY) - tolerance;
                const maxY = Math.max(shape.startY, shape.endY) + tolerance;
                
                const isInRect = x >= minX && x <= maxX && y >= minY && y <= maxY;
                console.log(`Rectangle bounds: (${minX},${minY})-(${maxX},${maxY}), point: (${x},${y}), match: ${isInRect}`);
                return isInRect;
                
            case 'circle':
                const centerX = shape.startX;
                const centerY = shape.startY;
                const radius = Math.sqrt(
                    Math.pow(shape.endX - shape.startX, 2) + 
                    Math.pow(shape.endY - shape.startY, 2)
                ) + tolerance;
                
                const distanceToCenter = Math.sqrt(
                    Math.pow(x - centerX, 2) + 
                    Math.pow(y - centerY, 2)
                );
                
                const isInCircle = distanceToCenter <= radius;
                console.log(`Circle center: (${centerX},${centerY}), radius: ${radius}, point: (${x},${y}), distance: ${distanceToCenter}, match: ${isInCircle}`);
                return isInCircle;
                
            case 'line':
            case 'arrow':
                // Check if point is near the line
                const lineLength = Math.sqrt(
                    Math.pow(shape.endX - shape.startX, 2) + 
                    Math.pow(shape.endY - shape.startY, 2)
                );
                
                if (lineLength === 0) return false;
                
                // Calculate distance from point to line
                const distanceToLine = Math.abs(
                    (shape.endY - shape.startY) * x - 
                    (shape.endX - shape.startX) * y + 
                    shape.endX * shape.startY - 
                    shape.endY * shape.startX
                ) / lineLength;
                
                const isNearLine = distanceToLine <= tolerance;
                console.log(`Line: (${shape.startX},${shape.startY})-(${shape.endX},${shape.endY}), point: (${x},${y}), distance: ${distanceToLine}, match: ${isNearLine}`);
                return isNearLine;
                
            case 'text':
                // Check if point is near the text position
                const isNearText = Math.abs(x - shape.startX) <= tolerance * 2 && 
                       Math.abs(y - shape.startY) <= tolerance * 2;
                       
                console.log(`Text at: (${shape.startX},${shape.startY}), point: (${x},${y}), match: ${isNearText}`);
                return isNearText;
                
            default:
                return false;
        }
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
        
        // Draw existing annotations (excluding the active one)
        annotations.forEach(annotation => {
            if (annotation.id !== activeAnnotationId) {
                drawAnnotationShapes(annotation.shapes, false);
            }
        });
        
        // Draw current annotation being edited (if any)
        if (currentAnnotation) {
            console.log("Drawing current annotation with shapes:", currentAnnotation.shapes);
            drawAnnotationShapes(currentAnnotation.shapes, true);
        }
        
        // Draw temporary shape
        if (tempShape) {
            drawShape(tempShape, true);
        }
    }
    
    function drawAnnotationShapes(shapes, isActive) {
        if (!shapes) return;
        shapes.forEach(shape => {
            drawShape(shape, isActive);
        });
    }
    
    function drawShape(shape, isActive) {
        ctx.beginPath();
        ctx.strokeStyle = shape.color || 'red';
        ctx.lineWidth = shape.width || 3;
        
        // Add highlighting if this is the active annotation
        if (isActive) {
            ctx.shadowColor = 'yellow';
            ctx.shadowBlur = 10;
        } else {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        }
        
        switch (shape.tool) {
            case 'rectangle':
                ctx.rect(
                    shape.startX, 
                    shape.startY, 
                    shape.endX - shape.startX, 
                    shape.endY - shape.startY
                );
                break;
                
            case 'circle':
                const radius = Math.sqrt(
                    Math.pow(shape.endX - shape.startX, 2) + 
                    Math.pow(shape.endY - shape.startY, 2)
                );
                ctx.arc(
                    shape.startX, 
                    shape.startY, 
                    radius, 
                    0, 
                    2 * Math.PI
                );
                break;
                
            case 'line':
                ctx.moveTo(shape.startX, shape.startY);
                ctx.lineTo(shape.endX, shape.endY);
                break;
                
            case 'arrow':
                // Draw line
                ctx.moveTo(shape.startX, shape.startY);
                ctx.lineTo(shape.endX, shape.endY);
                
                // Calculate arrow head
                const angle = Math.atan2(
                    shape.endY - shape.startY,
                    shape.endX - shape.startX
                );
                const headlen = 10; // Length of arrow head
                
                // Draw arrow head
                ctx.lineTo(
                    shape.endX - headlen * Math.cos(angle - Math.PI / 6),
                    shape.endY - headlen * Math.sin(angle - Math.PI / 6)
                );
                ctx.moveTo(shape.endX, shape.endY);
                ctx.lineTo(
                    shape.endX - headlen * Math.cos(angle + Math.PI / 6),
                    shape.endY - headlen * Math.sin(angle + Math.PI / 6)
                );
                break;
                
            case 'text':
                if (shape.finding) {
                    ctx.font = '14px Arial';
                    ctx.fillStyle = shape.color || 'red';
                    ctx.fillText(
                        shape.finding,
                        shape.startX,
                        shape.startY
                    );
                }
                break;
        }
        
        ctx.stroke();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
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
            if (annotation.id === activeAnnotationId) {
                item.classList.add('active');
            }
            
            item.innerHTML = `
                <h4>${annotation.finding}</h4>
                <p><strong>Shapes:</strong> ${annotation.shapes ? annotation.shapes.length : 0}</p>
                <p><strong>Confidence:</strong> ${annotation.confidence}/10</p>
                <p><strong>Notes:</strong> ${annotation.notes || 'None'}</p>
                <p><strong>Reviewer:</strong> ${annotation.reviewerId}</p>
                <p><strong>Time:</strong> ${new Date(annotation.timestamp).toLocaleString()}</p>
                <div class="annotation-actions">
                    <button class="edit-annotation" data-id="${annotation.id}">Edit</button>
                    <button class="delete-annotation" data-id="${annotation.id}">Delete</button>
                </div>
            `;
            
            // Add event listeners
            const editBtn = item.querySelector('.edit-annotation');
            editBtn.addEventListener('click', () => {
                editAnnotation(annotation.id);
            });
            
            const deleteBtn = item.querySelector('.delete-annotation');
            deleteBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to delete this annotation?')) {
                    deleteAnnotation(annotation.id);
                }
            });
            
            listElement.appendChild(item);
        });
    }
    
    function deleteAnnotation(annotationId) {
        // Remove locally
        annotations = annotations.filter(a => a.id !== annotationId);
        
        // Update UI
        if (activeAnnotationId === annotationId) {
            cancelAnnotation();
        }
        
        // Redraw and update list
        drawAnnotations();
        updateAnnotationList();
        
        // Remove from server
        fetch(`/api/annotations/${studyUid}/${annotationId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to delete annotation');
            console.log('Annotation deleted successfully');
        })
        .catch(error => {
            console.error('Error deleting annotation:', error);
        });
    }
    
    function updateConfidenceValue() {
        const value = document.getElementById('confidence').value;
        document.getElementById('confidence-value').textContent = value;
    }
    
    // Add event listeners for shape removal
    canvas.addEventListener('click', function(e) {
        if (document.getElementById('remove-shape').classList.contains('active')) {
            removeShape(e);
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
        setupCanvas();
    });
});