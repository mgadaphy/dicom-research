/**
 * Consensus Viewer JavaScript
 * Handles the frontend functionality for comparing annotations from different reviewers
 */

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const dicomPreview = document.getElementById('dicom-preview');
    const annotationCanvas = document.getElementById('annotation-canvas');
    const ctx = annotationCanvas.getContext('2d');
    const studyUid = document.getElementById('study-uid').value;
    const patientIdElement = document.getElementById('patient-id');
    const studyDateElement = document.getElementById('study-date');
    const reviewerList = document.getElementById('reviewer-list');
    const discrepancyContainer = document.getElementById('discrepancy-container');
    const prevImageBtn = document.getElementById('prev-image');
    const nextImageBtn = document.getElementById('next-image');
    const viewModeRadios = document.querySelectorAll('input[name="view-mode"]');
    const discrepancyList = document.getElementById('discrepancy-list');
    const discrepancyToggle = document.getElementById('show-discrepancies');
    
    // Current state
    let currentImageIndex = 0;
    let dicomImages = [];
    let reviewerAnnotations = {};
    let activeReviewers = {};
    let viewMode = 'overlay';
    let discrepancyThresholds = {
        spatial: {
            min: 0.1,  // Minimum overlap to consider
            max: 0.8   // Maximum overlap to still consider a spatial discrepancy
        },
        classification: {
            min: 0.5   // Minimum overlap to check for classification discrepancies
        },
        presence: {
            threshold: 0.1  // Threshold below which we consider it a presence/absence discrepancy
        }
    };
    let discrepancyTypes = {
        spatial: true,
        classification: true,
        presence: true,
        severity: true,
        measurement: true
    };
    let showDiscrepancies = false; // Set to false by default to match HTML
    let imageWidth = 0;
    let imageHeight = 0;
    let imageLeft = 0;
    let imageTop = 0;
    let discrepancies = [];
    
    // Global variables for image dimensions and scaling
    let originalImageWidth = 0;
    let originalImageHeight = 0;
    let displayedImageWidth = 0;
    let displayedImageHeight = 0;
    let scaleFactorX = 1;
    let scaleFactorY = 1;
    
    // Add variables to track the image position and dimensions within the canvas
    let imageRect = {
        x: 0,
        y: 0,
        width: 0,
        height: 0
    };
    
    // Reviewer colors (for annotation display)
    const colors = [
        '#f44336', // Red
        '#2196F3', // Blue
        '#4CAF50', // Green
        '#FF9800', // Orange
        '#9C27B0', // Purple
        '#00BCD4', // Cyan
        '#FFEB3B', // Yellow
        '#795548', // Brown
        '#607D8B'  // Blue Grey
    ];
    
    // Initialize
    loadStudyMetadata();
    loadDicomImages();
    loadAnnotations();
    initEventListeners();
    
    // Event Listeners
    function initEventListeners() {
        // Navigation buttons
        prevImageBtn.addEventListener('click', () => {
            if (currentImageIndex > 0) {
                currentImageIndex--;
                loadImage(dicomImages[currentImageIndex]);
            }
        });
        
        nextImageBtn.addEventListener('click', () => {
            if (currentImageIndex < dicomImages.length - 1) {
                currentImageIndex++;
                loadImage(dicomImages[currentImageIndex]);
            }
        });
        
        // View mode selection
        viewModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                viewMode = e.target.value;
                redrawAnnotations();
            });
        });
        
        // Discrepancy toggle
        const discrepancyToggle = document.getElementById('show-discrepancies');
        if (discrepancyToggle) {
            discrepancyToggle.addEventListener('change', (e) => {
                showDiscrepancies = e.target.checked;
                if (showDiscrepancies) {
                    detectDiscrepancies();
                    drawDiscrepancies();
                } else {
                    // Clear discrepancy display
                    discrepancyList.innerHTML = '';
                    redrawAnnotations();
                }
            });
        }
        
        // Add resize observer to handle container resizing
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target === annotationCanvas.parentNode) {
                    console.log('Canvas container resized');
                    updateCanvasSize();
                    redrawAnnotations();
                }
            }
        });
        
        // Observe the canvas container for size changes
        resizeObserver.observe(annotationCanvas.parentNode);
        
        // Add an event listener for scroll events
        window.addEventListener('scroll', () => {
            // Update the canvas position when scrolling
            updateCanvasPosition();
            // Only redraw if we have annotations
            if (Object.keys(reviewerAnnotations).length > 0) {
                redrawAnnotations();
            }
        });
    }
    
    // Add window resize event listener to handle responsive scaling
    window.addEventListener('resize', () => {
        // Update canvas size and redraw with proper scaling
        updateCanvasSize();
        
        // Redraw annotations with the new scaling factors
        redrawAnnotations();
    });
    
    // Functions
    function loadStudyMetadata() {
        fetch(`/api/dicom/${studyUid}/metadata`)
            .then(response => {
                if (!response.ok) throw new Error('Failed to load study metadata');
                return response.json();
            })
            .then(metadata => {
                patientIdElement.textContent = metadata.patientId || 'Unknown';
                studyDateElement.textContent = metadata.studyDate || 'Unknown';
            })
            .catch(error => {
                console.error('Error loading study metadata:', error);
                patientIdElement.textContent = 'Error loading';
                studyDateElement.textContent = 'Error loading';
            });
    }
    
    function loadDicomImages() {
        // Use the preview endpoint that's already working in the annotation viewer
        dicomPreview.src = `/api/dicom/${studyUid}/preview`;
        dicomPreview.onload = function() {
            // Store the original image dimensions
            originalImageWidth = dicomPreview.naturalWidth;
            originalImageHeight = dicomPreview.naturalHeight;
            
            console.log(`Original image dimensions: ${originalImageWidth}x${originalImageHeight}`);
            
            updateCanvasSize();
            redrawAnnotations();
            
            // Since we're only loading one image, disable navigation buttons
            prevImageBtn.disabled = true;
            nextImageBtn.disabled = true;
        };
        
        dicomPreview.onerror = function() {
            console.error('Error loading DICOM image');
            // Display error message on the canvas
            ctx.fillStyle = 'black';
            ctx.font = '16px Arial';
            ctx.fillText('Error loading DICOM image', 20, 50);
        };
    }
    
    function loadImage(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = function() {
                // Store the original image dimensions
                originalImageWidth = img.naturalWidth;
                originalImageHeight = img.naturalHeight;
                
                console.log(`Original image dimensions: ${originalImageWidth}x${originalImageHeight}`);
                
                // Draw the image to the canvas
                drawImage(img);
                
                // Store the displayed image dimensions
                updateDisplayedImageDimensions();
                
                resolve(img);
            };
            img.onerror = function() {
                reject(new Error(`Failed to load image: ${imageUrl}`));
            };
            img.src = imageUrl;
        });
    }
    
    function drawImage(img) {
        // Clear the canvas
        ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
        
        // Make sure we have the latest canvas position
        updateCanvasPosition();
        
        console.log('Drawing image to canvas');
        
        // Calculate dimensions to maintain aspect ratio
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        
        // Set canvas dimensions to match container
        annotationCanvas.width = annotationCanvas.parentNode.clientWidth;
        annotationCanvas.height = annotationCanvas.width / aspectRatio;
        
        // Draw the image to fill the canvas
        ctx.drawImage(img, 0, 0, annotationCanvas.width, annotationCanvas.height);
        
        // Update the displayed image dimensions
        displayedImageWidth = annotationCanvas.width;
        displayedImageHeight = annotationCanvas.height;
        
        // Calculate scaling factors
        scaleFactorX = displayedImageWidth / originalImageWidth;
        scaleFactorY = displayedImageHeight / originalImageHeight;
        
        console.log(`Display dimensions: ${displayedImageWidth}x${displayedImageHeight}`);
        console.log(`Scale factors: X=${scaleFactorX}, Y=${scaleFactorY}`);
        
        // Update image position for coordinate calculations
        imageLeft = annotationCanvas.offsetLeft;
        imageTop = annotationCanvas.offsetTop;
        
        // Redraw annotations if they exist
        if (reviewerAnnotations && Object.keys(reviewerAnnotations).length > 0) {
            redrawAnnotations();
        }
    }
    
    function updateDisplayedImageDimensions() {
        displayedImageWidth = annotationCanvas.width;
        displayedImageHeight = annotationCanvas.height;
        
        // Calculate scaling factors
        scaleFactorX = displayedImageWidth / originalImageWidth;
        scaleFactorY = displayedImageHeight / originalImageHeight;
        
        console.log(`Updated display dimensions: ${displayedImageWidth}x${displayedImageHeight}`);
        console.log(`Updated scale factors: X=${scaleFactorX}, Y=${scaleFactorY}`);
    }
    
    function updateCanvasSize() {
        // Get the container dimensions
        const containerWidth = annotationCanvas.parentNode.clientWidth;
        
        // Store the current scroll position
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        
        // Calculate aspect ratio from the original image
        const aspectRatio = originalImageWidth / originalImageHeight || 1;
        
        // Set canvas dimensions to maintain aspect ratio
        annotationCanvas.width = containerWidth;
        annotationCanvas.height = containerWidth / aspectRatio;
        
        // Store the displayed image dimensions
        displayedImageWidth = annotationCanvas.width;
        displayedImageHeight = annotationCanvas.height;
        
        // Calculate scaling factors
        scaleFactorX = displayedImageWidth / originalImageWidth;
        scaleFactorY = displayedImageHeight / originalImageHeight;
        
        console.log(`Display dimensions: ${displayedImageWidth}x${displayedImageHeight}`);
        console.log(`Scale factors: X=${scaleFactorX}, Y=${scaleFactorY}`);
        
        // Get the canvas position relative to the viewport
        const canvasRect = annotationCanvas.getBoundingClientRect();
        
        // Update image position for coordinate calculations
        // Add scroll position to get absolute position
        imageLeft = canvasRect.left + scrollX;
        imageTop = canvasRect.top + scrollY;
        
        // Update imageRect with the current image dimensions and position
        imageRect = {
            x: 0, // Image starts at 0,0 within the canvas
            y: 0,
            width: displayedImageWidth,
            height: displayedImageHeight
        };
        
        console.log('Updated imageRect:', imageRect);
        
        // Redraw annotations if they exist
        if (reviewerAnnotations && 
            ((Array.isArray(reviewerAnnotations) && reviewerAnnotations.length > 0) || 
             (typeof reviewerAnnotations === 'object' && Object.keys(reviewerAnnotations).length > 0))) {
            redrawAnnotations();
        }
    }
    
    function updateNavigationButtons() {
        prevImageBtn.disabled = currentImageIndex === 0;
        nextImageBtn.disabled = currentImageIndex === dicomImages.length - 1;
    }
    
    function loadAnnotations() {
        console.log('Loading annotations for study:', studyUid);
        fetch(`/api/studies/${studyUid}/annotations/by-reviewer`)
            .then(response => {
                if (!response.ok) throw new Error('Failed to load annotations');
                return response.json();
            })
            .then(data => {
                console.log('Annotations data received:', data);
                reviewerAnnotations = data;
                
                // Process annotations to add imageIndex if missing
                if (Array.isArray(reviewerAnnotations)) {
                    reviewerAnnotations.forEach(reviewer => {
                        console.log(`Processing annotations for reviewer: ${reviewer.reviewerName}`);
                        reviewer.annotations.forEach(annotation => {
                            // Set default imageIndex if not present
                            if (annotation.imageIndex === undefined) {
                                annotation.imageIndex = 0;
                            }
                            
                            // Ensure shapes is an array
                            if (!annotation.shapes || !Array.isArray(annotation.shapes)) {
                                console.warn(`Annotation ${annotation.id} has invalid shapes, initializing empty array`);
                                annotation.shapes = [];
                            }
                            
                            console.log(`Processed annotation: ${annotation.id}, shapes: ${annotation.shapes.length}`);
                        });
                    });
                }
                
                displayReviewerToggles();
                detectDiscrepancies();
                redrawAnnotations();
            })
            .catch(error => {
                console.error('Error loading annotations:', error);
                reviewerList.innerHTML = '<p>Error loading annotations</p>';
            });
    }
    
    function displayReviewerToggles() {
        console.log('Displaying reviewer toggles:', reviewerAnnotations);
        
        // Check if reviewerList exists
        const reviewerList = document.getElementById('reviewer-list');
        if (!reviewerList) {
            console.error('Reviewer list element not found');
            return;
        }
        
        // Clear the reviewer list
        reviewerList.innerHTML = '';
        
        // Check if we have any annotations
        if (Array.isArray(reviewerAnnotations)) {
            // Original format: array of reviewer objects
            if (reviewerAnnotations.length === 0) {
                console.warn('No reviewer annotations available');
                reviewerList.innerHTML = '<p>No annotations found for this study</p>';
                return;
            }
            
            // Create toggles for each reviewer
            reviewerAnnotations.forEach((reviewer, index) => {
                if (!reviewer || !reviewer.reviewerName) {
                    console.warn('Invalid reviewer data:', reviewer);
                    return;
                }
                
                const colorIndex = index % colors.length;
                const color = colors[colorIndex];
                
                // Create toggle div
                const toggleDiv = document.createElement('div');
                toggleDiv.className = 'reviewer-toggle';
                
                // Create checkbox
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `reviewer-${reviewer.reviewerName}`;
                
                // Set checked by default
                checkbox.checked = true;
                activeReviewers[reviewer.reviewerName] = true;
                
                // Add event listener
                checkbox.addEventListener('change', function() {
                    activeReviewers[reviewer.reviewerName] = this.checked;
                    redrawAnnotations();
                });
                
                // Create label
                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.textContent = `${reviewer.reviewerName} (${reviewer.annotations.length} annotations)`;
                label.style.color = color;
                
                // Append elements
                toggleDiv.appendChild(checkbox);
                toggleDiv.appendChild(label);
                
                reviewerList.appendChild(toggleDiv);
            });
        } else if (typeof reviewerAnnotations === 'object' && reviewerAnnotations !== null) {
            // New format: object with reviewer IDs as keys
            const reviewerIds = Object.keys(reviewerAnnotations);
            
            if (reviewerIds.length === 0) {
                console.warn('No reviewer annotations available');
                reviewerList.innerHTML = '<p>No annotations found for this study</p>';
                return;
            }
            
            // Create toggles for each reviewer
            reviewerIds.forEach((reviewerId, index) => {
                const colorIndex = index % colors.length;
                const color = colors[colorIndex];
                
                // Create toggle div
                const toggleDiv = document.createElement('div');
                toggleDiv.className = 'reviewer-toggle';
                
                // Create checkbox
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `reviewer-${reviewerId}`;
                
                // Set checked by default
                checkbox.checked = true;
                activeReviewers[reviewerId] = true;
                
                // Add event listener
                checkbox.addEventListener('change', function() {
                    activeReviewers[reviewerId] = this.checked;
                    redrawAnnotations();
                });
                
                // Create label
                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.textContent = `Reviewer ${reviewerId} (${reviewerAnnotations[reviewerId].length} annotations)`;
                label.style.color = color;
                
                // Append elements
                toggleDiv.appendChild(checkbox);
                toggleDiv.appendChild(label);
                
                reviewerList.appendChild(toggleDiv);
            });
        } else {
            console.warn('Invalid reviewerAnnotations format:', reviewerAnnotations);
            reviewerList.innerHTML = '<p>No annotations found for this study</p>';
        }
        
        console.log('Reviewer toggles displayed');
    }
    
    function redrawAnnotations() {
        console.log('Redrawing annotations');
        
        // Clear the canvas
        ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
        
        // Make sure we have the latest canvas position
        updateCanvasPosition();
        
        // Draw annotations based on current view mode
        if (viewMode === 'overlay') {
            drawOverlayView();
        } else if (viewMode === 'side-by-side') {
            drawSideBySideView();
        }
        
        // Draw discrepancies if enabled
        if (showDiscrepancies) {
            // Re-detect discrepancies to ensure we only show those for active reviewers
            detectDiscrepancies();
            drawDiscrepancies();
        } else {
            // Update discrepancy list to show the message
            updateDiscrepancyCount();
        }
    }
    
    function drawOverlayView() {
        // Clear the canvas
        ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
        
        // Make sure we have the latest canvas position
        updateCanvasPosition();
        
        console.log('Drawing overlay view with reviewers:', reviewerAnnotations);
        
        // Check if reviewerAnnotations is an array (original format) or object (new format)
        if (Array.isArray(reviewerAnnotations)) {
            // Original format: array of reviewer objects
            reviewerAnnotations.forEach((reviewer, index) => {
                if (!activeReviewers[reviewer.reviewerName]) return;
                
                const colorIndex = index % colors.length;
                const color = colors[colorIndex];
                
                console.log(`Drawing annotations for ${reviewer.reviewerName}:`, reviewer.annotations.length);
                
                reviewer.annotations.forEach(annotation => {
                    // Only draw annotations for the current image or if imageIndex is not specified
                    if (annotation.imageIndex === undefined || annotation.imageIndex === currentImageIndex) {
                        drawAnnotation(annotation, color);
                    }
                });
            });
        } else {
            // New format: object with reviewer IDs as keys
            Object.keys(reviewerAnnotations).forEach(reviewerId => {
                if (activeReviewers[reviewerId]) {
                    const color = colors[parseInt(reviewerId) % colors.length];
                    reviewerAnnotations[reviewerId].forEach(annotation => {
                        drawAnnotation(annotation, color);
                    });
                }
            });
        }
        
        // Draw discrepancies if enabled
        if (showDiscrepancies) {
            drawDiscrepancies();
        }
    }
    
    function drawSideBySideView() {
        // This would be implemented to split the canvas and show annotations side by side
        // For now, we'll use the overlay view as a fallback
        drawOverlayView();
        
        // Display a message that this feature is coming soon
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, 200, 30);
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.fillText('Side-by-side view coming soon', 20, 30);
    }
    
    function drawAnnotation(annotation, color) {
        console.log('Drawing annotation:', annotation);
        
        // Check if shapes property exists and is an array
        if (!annotation.shapes || !Array.isArray(annotation.shapes)) {
            console.error('Annotation has no shapes array:', annotation);
            return;
        }
        
        // Draw all shapes in this annotation
        annotation.shapes.forEach(shape => {
            console.log('Drawing shape:', shape);
            
            // Skip if shape has no type
            const shapeType = shape.type || shape.tool;
            if (!shapeType) {
                console.error('Shape has no type:', shape);
                return;
            }
            
            // Make a copy of the shape to avoid modifying the original
            const shapeCopy = { ...shape };
            
            // Ensure the shape has the correct type property
            shapeCopy.type = shapeType;
            
            // Denormalize coordinates based on current image dimensions
            const denormalizedCoords = denormalizeCoordinates(shapeCopy);
            console.log('Denormalized coordinates:', denormalizedCoords);
            
            // Draw the shape with the appropriate color
            ctx.save(); // Save current context state
            drawShapeByType(denormalizedCoords, shapeType, color);
            ctx.restore(); // Restore context state
            
            // Add finding label if present
            if (annotation.finding) {
                drawFindingLabel(denormalizedCoords, annotation.finding, shapeType, color);
            }
        });
    }
    
    function drawShapeByType(coords, type, color) {
        // For debugging
        console.log(`Drawing shape type: ${type} with coords:`, coords);
        
        switch (type) {
            case 'rectangle':
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.rect(
                    coords.startX || coords.x || 0,
                    coords.startY || coords.y || 0,
                    (coords.width || (coords.endX - coords.startX) || 0),
                    (coords.height || (coords.endY - coords.startY) || 0)
                );
                ctx.stroke();
                ctx.fillStyle = color + '40'; // Add transparency
                ctx.fill();
                break;
                
            case 'circle':
            case 'ellipse':
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                
                // If we have explicit radius, use it
                let radius;
                if (coords.radius) {
                    radius = coords.radius;
                } 
                // Otherwise calculate from start/end points
                else if (coords.startX !== undefined && coords.endX !== undefined) {
                    radius = Math.sqrt(
                        Math.pow(coords.endX - coords.startX, 2) + 
                        Math.pow(coords.endY - coords.startY, 2)
                    );
                } 
                // Fallback to radiusX/radiusY
                else {
                    radius = Math.max(coords.radiusX || 0, coords.radiusY || 0);
                }
                
                ctx.arc(
                    coords.startX || coords.x || 0,
                    coords.startY || coords.y || 0,
                    radius,
                    0,
                    2 * Math.PI
                );
                ctx.stroke();
                ctx.fillStyle = color + '40'; // Add transparency
                ctx.fill();
                break;
                
            case 'line':
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.moveTo(coords.startX || coords.x1 || coords.fromX || 0, 
                           coords.startY || coords.y1 || coords.fromY || 0);
                ctx.lineTo(coords.endX || coords.x2 || coords.toX || 0, 
                           coords.endY || coords.y2 || coords.toY || 0);
                ctx.stroke();
                break;
                
            case 'arrow':
                // Draw the main line
                const startX = coords.startX || coords.x1 || coords.fromX || 0;
                const startY = coords.startY || coords.y1 || coords.fromY || 0;
                const endX = coords.endX || coords.x2 || coords.toX || 0;
                const endY = coords.endY || coords.y2 || coords.toY || 0;
                
                // Draw the line
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
                
                // Calculate arrow head
                const angle = Math.atan2(endY - startY, endX - startX);
                const headlen = 15; // Length of arrow head
                
                // Draw arrow head
                ctx.beginPath();
                ctx.fillStyle = color;
                ctx.moveTo(endX, endY);
                ctx.lineTo(
                    endX - headlen * Math.cos(angle - Math.PI / 6),
                    endY - headlen * Math.sin(angle - Math.PI / 6)
                );
                ctx.lineTo(
                    endX - headlen * Math.cos(angle + Math.PI / 6),
                    endY - headlen * Math.sin(angle + Math.PI / 6)
                );
                ctx.closePath();
                ctx.fill();
                break;
                
            case 'freehand':
                if (coords.points && Array.isArray(coords.points) && coords.points.length > 0) {
                    ctx.beginPath();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2;
                    ctx.moveTo(coords.points[0].x, coords.points[0].y);
                    
                    for (let i = 1; i < coords.points.length; i++) {
                        ctx.lineTo(coords.points[i].x, coords.points[i].y);
                    }
                    
                    if (coords.closed) {
                        ctx.closePath();
                        ctx.stroke();
                        ctx.fillStyle = color + '40'; // Add transparency
                        ctx.fill();
                    } else {
                        ctx.stroke();
                    }
                }
                break;
                
            case 'text':
                ctx.font = '14px Arial';
                ctx.fillStyle = color;
                ctx.fillText(
                    coords.text || '',
                    coords.startX || coords.x || 0,
                    coords.startY || coords.y || 0
                );
                break;
                
            default:
                console.warn('Unknown shape type:', type);
                return;
        }
    }
    
    function drawFindingLabel(coords, finding, shapeType, color) {
        if (!finding) return;
        
        ctx.font = '12px Arial';
        ctx.fillStyle = color;
        
        let labelX, labelY;
        
        switch (shapeType) {
            case 'rectangle':
                labelX = coords.x;
                labelY = coords.y - 5;
                break;
            case 'circle':
            case 'ellipse':
                // Calculate radius properly
                let radius = coords.radius;
                if (!radius && coords.startX !== undefined && coords.endX !== undefined) {
                    radius = Math.sqrt(
                        Math.pow(coords.endX - coords.startX, 2) + 
                        Math.pow(coords.endY - coords.startY, 2)
                    );
                } else if (!radius) {
                    radius = Math.max(coords.radiusX || 0, coords.radiusY || 0);
                }
                
                // Position label above the circle
                labelX = (coords.startX || coords.x) - (radius / 2);
                labelY = (coords.startY || coords.y) - radius - 10;
                break;
            case 'line':
            case 'arrow':
                labelX = coords.x1 || coords.fromX || coords.startX;
                labelY = (coords.y1 || coords.fromY || coords.startY) - 15;
                break;
            case 'freehand':
                if (coords.points && coords.points.length > 0) {
                    labelX = coords.points[0].x;
                    labelY = coords.points[0].y - 5;
                } else {
                    labelX = 10;
                    labelY = 10;
                }
                break;
            default:
                labelX = coords.x || 10;
                labelY = coords.y || 10;
        }
        
        ctx.fillText(finding, labelX, labelY);
    }
    
    function denormalizeCoordinates(shape) {
        console.log('Denormalizing shape:', shape);
        
        // Make sure we have valid image dimensions
        if (!originalImageWidth || !originalImageHeight) {
            console.error('Original image dimensions not set for coordinate conversion');
            return shape;
        }
        
        // Handle different shape types and property names
        const type = shape.type || shape.tool;
        
        // Check if coordinates are already denormalized
        const isNormalized = isShapeNormalized(shape);
        if (!isNormalized) {
            console.log('Shape already denormalized, returning as is');
            return shape;
        }
        
        // Create a copy of the shape to avoid modifying the original
        const denormalizedShape = { ...shape };
        
        // Set type consistently
        denormalizedShape.type = type;
        
        // Check if imageRect is properly initialized, if not use fallback values
        if (!imageRect || imageRect.width === undefined) {
            console.warn('imageRect not properly initialized, using fallback values');
            imageRect = {
                x: 0,
                y: 0,
                width: displayedImageWidth || annotationCanvas.width,
                height: displayedImageHeight || annotationCanvas.height
            };
        }
        
        console.log('Using imageRect for denormalization:', imageRect);
        
        // Denormalize based on shape type
        switch (type) {
            case 'rectangle':
                // Convert normalized (0-1) values to image-relative coordinates
                const rectStartX = shape.startX || shape.x || 0;
                const rectStartY = shape.startY || shape.y || 0;
                const rectEndX = shape.endX || (shape.x + shape.width) || 1;
                const rectEndY = shape.endY || (shape.y + shape.height) || 1;
                
                // First scale to image dimensions
                const imageRelativeStartX = rectStartX * imageRect.width;
                const imageRelativeStartY = rectStartY * imageRect.height;
                const imageRelativeEndX = rectEndX * imageRect.width;
                const imageRelativeEndY = rectEndY * imageRect.height;
                
                // Then adjust for image position offset to get canvas coordinates
                denormalizedShape.startX = imageRelativeStartX + imageRect.x;
                denormalizedShape.startY = imageRelativeStartY + imageRect.y;
                denormalizedShape.endX = imageRelativeEndX + imageRect.x;
                denormalizedShape.endY = imageRelativeEndY + imageRect.y;
                denormalizedShape.width = imageRelativeEndX - imageRelativeStartX;
                denormalizedShape.height = imageRelativeEndY - imageRelativeStartY;
                break;
                
            case 'circle':
            case 'ellipse':
                // Convert normalized center coordinates
                const centerX = shape.startX || shape.x || 0;
                const centerY = shape.startY || shape.y || 0;
                
                // First scale to image dimensions
                const imageRelativeCenterX = centerX * imageRect.width;
                const imageRelativeCenterY = centerY * imageRect.height;
                
                // Then adjust for image position
                denormalizedShape.startX = imageRelativeCenterX + imageRect.x;
                denormalizedShape.startY = imageRelativeCenterY + imageRect.y;
                
                // If we have explicit radius
                if (shape.radius !== undefined) {
                    denormalizedShape.radius = shape.radius * Math.min(imageRect.width, imageRect.height);
                }
                // Otherwise calculate from start/end points
                else if (shape.startX !== undefined && shape.endX !== undefined) {
                    const endX = shape.endX;
                    const endY = shape.endY;
                    
                    // Scale end coordinates
                    const imageRelativeEndX = endX * imageRect.width;
                    const imageRelativeEndY = endY * imageRect.height;
                    
                    // Adjust for image position
                    denormalizedShape.endX = imageRelativeEndX + imageRect.x;
                    denormalizedShape.endY = imageRelativeEndY + imageRect.y;
                    
                    // Calculate radius from denormalized coordinates
                    denormalizedShape.radius = Math.sqrt(
                        Math.pow(denormalizedShape.endX - denormalizedShape.startX, 2) + 
                        Math.pow(denormalizedShape.endY - denormalizedShape.startY, 2)
                    );
                }
                break;
                
            case 'line':
            case 'arrow':
                // Convert normalized start and end coordinates
                const lineStartX = shape.startX || 0;
                const lineStartY = shape.startY || 0;
                const lineEndX = shape.endX || 1;
                const lineEndY = shape.endY || 1;
                
                // First scale to image dimensions
                const imageRelativeLineStartX = lineStartX * imageRect.width;
                const imageRelativeLineStartY = lineStartY * imageRect.height;
                const imageRelativeLineEndX = lineEndX * imageRect.width;
                const imageRelativeLineEndY = lineEndY * imageRect.height;
                
                // Then adjust for image position
                denormalizedShape.startX = imageRelativeLineStartX + imageRect.x;
                denormalizedShape.startY = imageRelativeLineStartY + imageRect.y;
                denormalizedShape.endX = imageRelativeLineEndX + imageRect.x;
                denormalizedShape.endY = imageRelativeLineEndY + imageRect.y;
                break;
                
            default:
                console.warn(`Unknown shape type: ${type}, returning original shape`);
                return shape;
        }
        
        console.log('Denormalized shape:', denormalizedShape);
        return denormalizedShape;
    }
    
    function isShapeNormalized(shape) {
        // Check if shape has normalized coordinates (values between 0 and 1)
        // or has a normalized version flag
        
        if (shape.version === "normalized-1.0") {
            return true;
        }
        
        // Check common coordinate properties
        const coords = [
            shape.x, shape.y, shape.startX, shape.startY, 
            shape.endX, shape.endY, shape.x1, shape.y1, 
            shape.x2, shape.y2, shape.fromX, shape.fromY,
            shape.toX, shape.toY
        ];
        
        // If any coordinate is > 1, assume it's already denormalized
        for (const coord of coords) {
            if (coord !== undefined && coord > 1) {
                return false;
            }
        }
        
        // Check points array for freehand shapes
        if (shape.points && Array.isArray(shape.points) && shape.points.length > 0) {
            for (const point of shape.points) {
                if ((point.x !== undefined && point.x > 1) || 
                    (point.y !== undefined && point.y > 1)) {
                    return false;
                }
            }
        }
        
        // If we got here, assume coordinates are normalized
        return true;
    }
    
    function drawDiscrepancies() {
        if (!discrepancies || discrepancies.length === 0) {
            return;
        }
        
        console.log('Drawing discrepancies:', discrepancies);
        
        // Only show discrepancies for the current image
        const currentDiscrepancies = discrepancies.filter(d => 
            d.imageIndex === undefined || d.imageIndex === currentImageIndex
        );
        
        currentDiscrepancies.forEach(discrepancy => {
            // Skip discrepancies that involve inactive reviewers
            if (discrepancy.reviewers) {
                const allReviewersActive = discrepancy.reviewers.every(reviewer => 
                    activeReviewers[reviewer.reviewerId] || activeReviewers[reviewer.reviewerName]
                );
                
                if (!allReviewersActive) {
                    console.log('Skipping discrepancy for inactive reviewer');
                    return;
                }
            }
            
            // Highlight the discrepancy with a special color/effect
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 3;
            ctx.shadowColor = 'yellow';
            ctx.shadowBlur = 15;
            
            // Draw a rectangle around the discrepancy area
            ctx.beginPath();
            ctx.rect(
                discrepancy.x,
                discrepancy.y,
                discrepancy.width,
                discrepancy.height
            );
            ctx.stroke();
            
            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        });
    }
    
    function detectDiscrepancies() {
        console.log('Detecting discrepancies between reviewers');
        
        // Clear existing discrepancies
        discrepancies = [];
        
        // Skip if we don't have enough reviewers or if discrepancies are disabled
        if (!showDiscrepancies) {
            console.log('Discrepancy detection is disabled');
            updateDiscrepancyCount();
            return;
        }
        
        // Check if we have reviewerAnnotations in the array format
        if (Array.isArray(reviewerAnnotations)) {
            // Skip if we don't have at least 2 reviewers
            if (reviewerAnnotations.length < 2) {
                console.log('Not enough reviewers to detect discrepancies');
                return;
            }
            
            // Compare annotations between each pair of reviewers
            for (let i = 0; i < reviewerAnnotations.length; i++) {
                const reviewer1 = reviewerAnnotations[i];
                if (!activeReviewers[reviewer1.reviewerName]) continue;
                
                for (let j = i + 1; j < reviewerAnnotations.length; j++) {
                    const reviewer2 = reviewerAnnotations[j];
                    if (!activeReviewers[reviewer2.reviewerName]) continue;
                    
                    console.log(`Comparing annotations between ${reviewer1.reviewerName} and ${reviewer2.reviewerName}`);
                    
                    // Compare each annotation from reviewer1 with each from reviewer2
                    reviewer1.annotations.forEach(annotation1 => {
                        // Skip annotations not for the current image
                        if (annotation1.imageIndex !== currentImageIndex) return;
                        
                        reviewer2.annotations.forEach(annotation2 => {
                            // Skip annotations not for the current image
                            if (annotation2.imageIndex !== currentImageIndex) return;
                            
                            // Check for spatial overlap
                            const overlap = calculateOverlap(annotation1, annotation2);
                            
                            if (overlap > 0) {
                                console.log(`Found overlap (${overlap.toFixed(2)}) between annotations:`, 
                                    annotation1.id, annotation2.id);
                                
                                // If there's overlap but not complete agreement (partial overlap)
                                if (discrepancyTypes.spatial && 
                                    overlap > discrepancyThresholds.spatial.min && 
                                    overlap < discrepancyThresholds.spatial.max) {
                                    discrepancies.push({
                                        type: 'spatial',
                                        reviewers: [reviewer1.reviewerName, reviewer2.reviewerName],
                                        annotations: [annotation1, annotation2],
                                        overlap: overlap
                                    });
                                }
                                
                                // Check for classification discrepancies (finding differences)
                                if (discrepancyTypes.classification && 
                                    overlap > discrepancyThresholds.classification.min) {
                                    
                                    // Get findings, ensuring they exist and converting to lowercase for comparison
                                    const finding1 = (annotation1.finding || '').toLowerCase().trim();
                                    const finding2 = (annotation2.finding || '').toLowerCase().trim();
                                    
                                    // Check if findings are different and not empty
                                    if (finding1 && finding2 && finding1 !== finding2) {
                                        console.log(`Found classification discrepancy: "${finding1}" vs "${finding2}"`);
                                        
                                        discrepancies.push({
                                            type: 'classification',
                                            reviewers: [reviewer1.reviewerName, reviewer2.reviewerName],
                                            annotations: [annotation1, annotation2],
                                            findings: [annotation1.finding, annotation2.finding],
                                            overlap: overlap
                                        });
                                    }
                                }
                                
                                // Check for severity discrepancies
                                if (discrepancyTypes.severity && 
                                    overlap > discrepancyThresholds.classification.min) {
                                    
                                    // Get severity ratings if they exist
                                    const severity1 = annotation1.severity || annotation1.rating;
                                    const severity2 = annotation2.severity || annotation2.rating;
                                    
                                    // Check if severities are different and not undefined
                                    if (severity1 !== undefined && severity2 !== undefined && severity1 !== severity2) {
                                        console.log(`Found severity discrepancy: ${severity1} vs ${severity2}`);
                                        
                                        discrepancies.push({
                                            type: 'severity',
                                            reviewers: [reviewer1.reviewerName, reviewer2.reviewerName],
                                            annotations: [annotation1, annotation2],
                                            severities: [severity1, severity2],
                                            overlap: overlap
                                        });
                                    }
                                }
                                
                                // Check for measurement discrepancies
                                if (discrepancyTypes.measurement && 
                                    overlap > discrepancyThresholds.classification.min) {
                                    
                                    // Get measurements if they exist
                                    const measurement1 = getMeasurement(annotation1);
                                    const measurement2 = getMeasurement(annotation2);
                                    
                                    // Check if measurements are different by more than 10%
                                    if (measurement1 && measurement2) {
                                        const measurementDiff = Math.abs(measurement1 - measurement2) / Math.max(measurement1, measurement2);
                                        
                                        if (measurementDiff > 0.1) { // 10% difference threshold
                                            console.log(`Found measurement discrepancy: ${measurement1} vs ${measurement2}`);
                                            
                                            discrepancies.push({
                                                type: 'measurement',
                                                reviewers: [reviewer1.reviewerName, reviewer2.reviewerName],
                                                annotations: [annotation1, annotation2],
                                                measurements: [measurement1, measurement2],
                                                difference: measurementDiff,
                                                overlap: overlap
                                            });
                                        }
                                    }
                                }
                            }
                        });
                    });
                    
                    // Check for presence/absence discrepancies (annotations that one reviewer has but the other doesn't)
                    if (discrepancyTypes.presence) {
                        reviewer1.annotations.forEach(annotation1 => {
                            if (annotation1.imageIndex !== currentImageIndex) return;
                            
                            // Check if this annotation has any overlap with any annotation from reviewer2
                            let hasOverlap = false;
                            reviewer2.annotations.forEach(annotation2 => {
                                if (annotation2.imageIndex !== currentImageIndex) return;
                                
                                const overlap = calculateOverlap(annotation1, annotation2);
                                if (overlap > discrepancyThresholds.presence.threshold) {
                                    hasOverlap = true;
                                }
                            });
                            
                            // If no overlap, it's a presence/absence discrepancy
                            if (!hasOverlap) {
                                discrepancies.push({
                                    type: 'presence',
                                    reviewers: [reviewer1.reviewerName],
                                    annotations: [annotation1],
                                    message: `${reviewer1.reviewerName} marked a finding that ${reviewer2.reviewerName} did not`
                                });
                            }
                        });
                        
                        // Check the other way around too
                        reviewer2.annotations.forEach(annotation2 => {
                            if (annotation2.imageIndex !== currentImageIndex) return;
                            
                            // Check if this annotation has any overlap with any annotation from reviewer1
                            let hasOverlap = false;
                            reviewer1.annotations.forEach(annotation1 => {
                                if (annotation1.imageIndex !== currentImageIndex) return;
                                
                                const overlap = calculateOverlap(annotation1, annotation2);
                                if (overlap > discrepancyThresholds.presence.threshold) {
                                    hasOverlap = true;
                                }
                            });
                            
                            // If no overlap, it's a presence/absence discrepancy
                            if (!hasOverlap) {
                                discrepancies.push({
                                    type: 'presence',
                                    reviewers: [reviewer2.reviewerName],
                                    annotations: [annotation2],
                                    message: `${reviewer2.reviewerName} marked a finding that ${reviewer1.reviewerName} did not`
                                });
                            }
                        });
                    }
                }
            }
        } else if (typeof reviewerAnnotations === 'object' && reviewerAnnotations !== null) {
            // Handle the object format of reviewerAnnotations
            const reviewerIds = Object.keys(reviewerAnnotations).filter(id => activeReviewers[id]);
            
            if (reviewerIds.length < 2) {
                console.log('Not enough active reviewers to detect discrepancies');
                return;
            }
            
            // Compare annotations between each pair of reviewers
            for (let i = 0; i < reviewerIds.length; i++) {
                const reviewerId1 = reviewerIds[i];
                
                for (let j = i + 1; j < reviewerIds.length; j++) {
                    const reviewerId2 = reviewerIds[j];
                    
                    console.log(`Comparing annotations between Reviewer ${reviewerId1} and Reviewer ${reviewerId2}`);
                    
                    // Compare each annotation from reviewer1 with each from reviewer2
                    reviewerAnnotations[reviewerId1].forEach(annotation1 => {
                        // Skip annotations not for the current image
                        if (annotation1.imageIndex !== currentImageIndex) return;
                        
                        reviewerAnnotations[reviewerId2].forEach(annotation2 => {
                            // Skip annotations not for the current image
                            if (annotation2.imageIndex !== currentImageIndex) return;
                            
                            // Check for spatial overlap
                            const overlap = calculateOverlap(annotation1, annotation2);
                            
                            if (overlap > 0) {
                                console.log(`Found overlap (${overlap.toFixed(2)}) between annotations:`, 
                                    annotation1.id, annotation2.id);
                                
                                // If there's overlap but not complete agreement (partial overlap)
                                if (discrepancyTypes.spatial && 
                                    overlap > discrepancyThresholds.spatial.min && 
                                    overlap < discrepancyThresholds.spatial.max) {
                                    discrepancies.push({
                                        type: 'spatial',
                                        reviewers: [`Reviewer ${reviewerId1}`, `Reviewer ${reviewerId2}`],
                                        annotations: [annotation1, annotation2],
                                        overlap: overlap
                                    });
                                }
                                
                                // Check for classification discrepancies (finding differences)
                                if (discrepancyTypes.classification && 
                                    overlap > discrepancyThresholds.classification.min) {
                                    
                                    // Get findings, ensuring they exist and converting to lowercase for comparison
                                    const finding1 = (annotation1.finding || '').toLowerCase().trim();
                                    const finding2 = (annotation2.finding || '').toLowerCase().trim();
                                    
                                    // Check if findings are different and not empty
                                    if (finding1 && finding2 && finding1 !== finding2) {
                                        console.log(`Found classification discrepancy: "${finding1}" vs "${finding2}"`);
                                        
                                        discrepancies.push({
                                            type: 'classification',
                                            reviewers: [`Reviewer ${reviewerId1}`, `Reviewer ${reviewerId2}`],
                                            annotations: [annotation1, annotation2],
                                            findings: [annotation1.finding, annotation2.finding],
                                            overlap: overlap
                                        });
                                    }
                                }
                                
                                // Check for severity discrepancies
                                if (discrepancyTypes.severity && 
                                    overlap > discrepancyThresholds.classification.min) {
                                    
                                    // Get severity ratings if they exist
                                    const severity1 = annotation1.severity || annotation1.rating;
                                    const severity2 = annotation2.severity || annotation2.rating;
                                    
                                    // Check if severities are different and not undefined
                                    if (severity1 !== undefined && severity2 !== undefined && severity1 !== severity2) {
                                        console.log(`Found severity discrepancy: ${severity1} vs ${severity2}`);
                                        
                                        discrepancies.push({
                                            type: 'severity',
                                            reviewers: [`Reviewer ${reviewerId1}`, `Reviewer ${reviewerId2}`],
                                            annotations: [annotation1, annotation2],
                                            severities: [severity1, severity2],
                                            overlap: overlap
                                        });
                                    }
                                }
                                
                                // Check for measurement discrepancies
                                if (discrepancyTypes.measurement && 
                                    overlap > discrepancyThresholds.classification.min) {
                                    
                                    // Get measurements if they exist
                                    const measurement1 = getMeasurement(annotation1);
                                    const measurement2 = getMeasurement(annotation2);
                                    
                                    // Check if measurements are different by more than 10%
                                    if (measurement1 && measurement2) {
                                        const measurementDiff = Math.abs(measurement1 - measurement2) / Math.max(measurement1, measurement2);
                                        
                                        if (measurementDiff > 0.1) { // 10% difference threshold
                                            console.log(`Found measurement discrepancy: ${measurement1} vs ${measurement2}`);
                                            
                                            discrepancies.push({
                                                type: 'measurement',
                                                reviewers: [`Reviewer ${reviewerId1}`, `Reviewer ${reviewerId2}`],
                                                annotations: [annotation1, annotation2],
                                                measurements: [measurement1, measurement2],
                                                difference: measurementDiff,
                                                overlap: overlap
                                            });
                                        }
                                    }
                                }
                            }
                        });
                    });
                    
                    // Check for presence/absence discrepancies (annotations that one reviewer has but the other doesn't)
                    if (discrepancyTypes.presence) {
                        reviewerAnnotations[reviewerId1].forEach(annotation1 => {
                            if (annotation1.imageIndex !== currentImageIndex) return;
                            
                            // Check if this annotation has any overlap with any annotation from reviewer2
                            let hasOverlap = false;
                            reviewerAnnotations[reviewerId2].forEach(annotation2 => {
                                if (annotation2.imageIndex !== currentImageIndex) return;
                                
                                const overlap = calculateOverlap(annotation1, annotation2);
                                if (overlap > discrepancyThresholds.presence.threshold) {
                                    hasOverlap = true;
                                }
                            });
                            
                            // If no overlap, it's a presence/absence discrepancy
                            if (!hasOverlap) {
                                discrepancies.push({
                                    type: 'presence',
                                    reviewers: [`Reviewer ${reviewerId1}`],
                                    annotations: [annotation1],
                                    message: `Reviewer ${reviewerId1} marked a finding that Reviewer ${reviewerId2} did not`
                                });
                            }
                        });
                        
                        // Check the other way around too
                        reviewerAnnotations[reviewerId2].forEach(annotation2 => {
                            if (annotation2.imageIndex !== currentImageIndex) return;
                            
                            // Check if this annotation has any overlap with any annotation from reviewer1
                            let hasOverlap = false;
                            reviewerAnnotations[reviewerId1].forEach(annotation1 => {
                                if (annotation1.imageIndex !== currentImageIndex) return;
                                
                                const overlap = calculateOverlap(annotation1, annotation2);
                                if (overlap > discrepancyThresholds.presence.threshold) {
                                    hasOverlap = true;
                                }
                            });
                            
                            // If no overlap, it's a presence/absence discrepancy
                            if (!hasOverlap) {
                                discrepancies.push({
                                    type: 'presence',
                                    reviewers: [`Reviewer ${reviewerId2}`],
                                    annotations: [annotation2],
                                    message: `Reviewer ${reviewerId2} marked a finding that Reviewer ${reviewerId1} did not`
                                });
                            }
                        });
                    }
                }
            }
        }
        
        console.log(`Detected ${discrepancies.length} discrepancies`);
        
        // Update the discrepancy count display
        updateDiscrepancyCount();
        
        // Redraw to show discrepancies
        redrawAnnotations();
    }
    
    function calculateOverlap(annotation1, annotation2) {
        // Extract shapes from annotations
        const shape1 = annotation1.shapes && annotation1.shapes.length > 0 ? annotation1.shapes[0] : null;
        const shape2 = annotation2.shapes && annotation2.shapes.length > 0 ? annotation2.shapes[0] : null;
        
        if (!shape1 || !shape2) {
            console.warn('Missing shapes for overlap calculation');
            return 0;
        }
        
        // Get shape types
        const type1 = shape1.type || shape1.tool;
        const type2 = shape2.type || shape2.tool;
        
        console.log(`Comparing shapes: ${type1} vs ${type2}`);
        
        // Calculate overlap based on shape type
        if (type1 === 'rectangle' && type2 === 'rectangle') {
            return calculateRectangleOverlap(shape1, shape2);
        } else if ((type1 === 'circle' || type1 === 'ellipse') && 
                   (type2 === 'circle' || type2 === 'ellipse')) {
            return calculateCircleOverlap(shape1, shape2);
        } else if ((type1 === 'line' && type2 === 'line') ||
                   (type1 === 'arrow' && type2 === 'arrow')) {
            // Same type of linear annotations - higher overlap
            return calculateLinearOverlap(shape1, shape2);
        } else if ((type1 === 'line' && type2 === 'arrow') ||
                   (type1 === 'arrow' && type2 === 'line')) {
            // Different linear annotation types - should be flagged as discrepancy
            // Return a lower overlap value to ensure it's detected as a discrepancy
            return 0.3; // Just enough overlap to trigger classification check but low enough for spatial discrepancy
        } else {
            // For different shape types, use bounding box approximation
            return calculateBoundingBoxOverlap(shape1, shape2);
        }
    }
    
    function calculateLinearOverlap(line1, line2) {
        // Normalize coordinates if needed
        const l1 = denormalizeCoordinates(line1);
        const l2 = denormalizeCoordinates(line2);
        
        // Get line endpoints
        const l1StartX = l1.startX || 0;
        const l1StartY = l1.startY || 0;
        const l1EndX = l1.endX || 0;
        const l1EndY = l1.endY || 0;
        
        const l2StartX = l2.startX || 0;
        const l2StartY = l2.startY || 0;
        const l2EndX = l2.endX || 0;
        const l2EndY = l2.endY || 0;
        
        // Calculate line lengths
        const l1Length = Math.sqrt(Math.pow(l1EndX - l1StartX, 2) + Math.pow(l1EndY - l1StartY, 2));
        const l2Length = Math.sqrt(Math.pow(l2EndX - l2StartX, 2) + Math.pow(l2EndY - l2StartY, 2));
        
        // Calculate angles
        const l1Angle = Math.atan2(l1EndY - l1StartY, l1EndX - l1StartX);
        const l2Angle = Math.atan2(l2EndY - l2StartY, l2EndX - l2StartX);
        
        // Calculate angle difference (normalized to 0-PI)
        let angleDiff = Math.abs(l1Angle - l2Angle);
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
        
        // Normalize angle difference to a 0-1 scale (0 = same direction, 1 = opposite direction)
        const angleOverlap = 1 - (angleDiff / Math.PI);
        
        // Calculate distance between midpoints
        const l1MidX = (l1StartX + l1EndX) / 2;
        const l1MidY = (l1StartY + l1EndY) / 2;
        const l2MidX = (l2StartX + l2EndX) / 2;
        const l2MidY = (l2StartY + l2EndY) / 2;
        
        const midpointDistance = Math.sqrt(Math.pow(l2MidX - l1MidX, 2) + Math.pow(l2MidY - l1MidY, 2));
        
        // Calculate proximity factor (1 when midpoints are close, 0 when far)
        const maxDistance = Math.max(l1Length, l2Length);
        const proximityFactor = Math.max(0, 1 - (midpointDistance / maxDistance));
        
        // Calculate length similarity (1 when same length, 0 when very different)
        const lengthRatio = Math.min(l1Length, l2Length) / Math.max(l1Length, l2Length);
        
        // Combine factors to get overall overlap
        // Weight angle more heavily than proximity and length
        const overlapScore = (angleOverlap * 0.6) + (proximityFactor * 0.3) + (lengthRatio * 0.1);
        
        console.log(`Linear overlap: angle=${angleOverlap.toFixed(2)}, proximity=${proximityFactor.toFixed(2)}, length=${lengthRatio.toFixed(2)}, score=${overlapScore.toFixed(2)}`);
        
        return overlapScore;
    }
    
    function calculateRectangleOverlap(rect1, rect2) {
        // Normalize coordinates if needed
        const r1 = denormalizeCoordinates(rect1);
        const r2 = denormalizeCoordinates(rect2);
        
        // Get rectangle coordinates
        const r1Left = r1.startX || r1.x || 0;
        const r1Top = r1.startY || r1.y || 0;
        const r1Right = r1.endX || (r1.startX + r1.width) || 0;
        const r1Bottom = r1.endY || (r1.startY + r1.height) || 0;
        
        const r2Left = r2.startX || r2.x || 0;
        const r2Top = r2.startY || r2.y || 0;
        const r2Right = r2.endX || (r2.startX + r2.width) || 0;
        const r2Bottom = r2.endY || (r2.startY + r2.height) || 0;
        
        // Calculate overlap area
        const overlapLeft = Math.max(r1Left, r2Left);
        const overlapTop = Math.max(r1Top, r2Top);
        const overlapRight = Math.min(r1Right, r2Right);
        const overlapBottom = Math.min(r1Bottom, r2Bottom);
        
        // Check if there is an overlap
        if (overlapLeft < overlapRight && overlapTop < overlapBottom) {
            const overlapArea = (overlapRight - overlapLeft) * (overlapBottom - overlapTop);
            const r1Area = (r1Right - r1Left) * (r1Bottom - r1Top);
            const r2Area = (r2Right - r2Left) * (r2Bottom - r2Top);
            
            // Return the Intersection over Union (IoU)
            return overlapArea / (r1Area + r2Area - overlapArea);
        }
        
        return 0; // No overlap
    }
    
    function calculateCircleOverlap(circle1, circle2) {
        // Normalize coordinates if needed
        const c1 = denormalizeCoordinates(circle1);
        const c2 = denormalizeCoordinates(circle2);
        
        // Get circle centers
        const c1X = c1.startX || c1.x || 0;
        const c1Y = c1.startY || c1.y || 0;
        const c2X = c2.startX || c2.x || 0;
        const c2Y = c2.startY || c2.y || 0;
        
        // Get circle radii
        let r1 = c1.radius;
        if (r1 === undefined) {
            // Calculate from start/end points if available
            if (c1.endX !== undefined) {
                r1 = Math.sqrt(
                    Math.pow(c1.endX - c1.startX, 2) + 
                    Math.pow(c1.endY - c1.startY, 2)
                );
            } else {
                r1 = Math.max(c1.radiusX || 0, c1.radiusY || 0);
            }
        }
        
        let r2 = c2.radius;
        if (r2 === undefined) {
            // Calculate from start/end points if available
            if (c2.endX !== undefined) {
                r2 = Math.sqrt(
                    Math.pow(c2.endX - c2.startX, 2) + 
                    Math.pow(c2.endY - c2.startY, 2)
                );
            } else {
                r2 = Math.max(c2.radiusX || 0, c2.radiusY || 0);
            }
        }
        
        // Calculate distance between centers
        const distance = Math.sqrt(Math.pow(c2X - c1X, 2) + Math.pow(c2Y - c1Y, 2));
        
        // Check if circles are completely separate
        if (distance > r1 + r2) {
            return 0;
        }
        
        // Check if one circle is completely inside the other
        if (distance <= Math.abs(r1 - r2)) {
            // Return ratio of smaller circle area to larger circle area
            const smallerRadius = Math.min(r1, r2);
            const largerRadius = Math.max(r1, r2);
            return Math.pow(smallerRadius / largerRadius, 2);
        }
        
        // Calculate overlap area for partially overlapping circles
        // This is a complex calculation involving the area of circular segments
        // For simplicity, we'll use an approximation based on the distance
        const overlapRatio = 1 - (distance / (r1 + r2));
        return overlapRatio;
    }
    
    function calculateBoundingBoxOverlap(shape1, shape2) {
        // For different shape types, convert to bounding boxes and calculate overlap
        const bbox1 = getBoundingBox(shape1);
        const bbox2 = getBoundingBox(shape2);
        
        return calculateRectangleOverlap(bbox1, bbox2);
    }
    
    function getBoundingBox(shape) {
        // Normalize coordinates if needed
        const s = denormalizeCoordinates(shape);
        
        // Get shape type
        const type = s.type || s.tool;
        
        // Create a bounding box based on shape type
        if (type === 'rectangle') {
            return {
                startX: s.startX || s.x || 0,
                startY: s.startY || s.y || 0,
                endX: s.endX || (s.startX + s.width) || 0,
                endY: s.endY || (s.startY + s.height) || 0
            };
        } else if (type === 'circle' || type === 'ellipse') {
            const centerX = s.startX || s.x || 0;
            const centerY = s.startY || s.y || 0;
            
            // Get radius
            let radius;
            if (s.radius) {
                radius = s.radius;
            } 
            // Otherwise calculate from start/end points
            else if (s.startX !== undefined && s.endX !== undefined) {
                radius = Math.sqrt(
                    Math.pow(s.endX - s.startX, 2) + 
                    Math.pow(s.endY - s.startY, 2)
                );
            } 
            // Fallback to radiusX/radiusY
            else {
                radius = Math.max(s.radiusX || 0, s.radiusY || 0);
            }
            
            return {
                startX: centerX - radius,
                startY: centerY - radius,
                endX: centerX + radius,
                endY: centerY + radius
            };
        } else if (type === 'line' || type === 'arrow') {
            const startX = s.startX || 0;
            const startY = s.startY || 0;
            const endX = s.endX || 0;
            const endY = s.endY || 0;
            
            return {
                startX: Math.min(startX, endX),
                startY: Math.min(startY, endY),
                endX: Math.max(startX, endX),
                endY: Math.max(startY, endY)
            };
        } else {
            console.warn(`Unknown shape type for bounding box: ${type}`);
            return {
                startX: 0,
                startY: 0,
                endX: 0,
                endY: 0
            };
        }
    }
    
    function drawDiscrepancies() {
        if (!discrepancies || discrepancies.length === 0) {
            console.log('No discrepancies to draw');
            return;
        }
        
        console.log(`Drawing ${discrepancies.length} discrepancies`);
        
        // Save current context state
        ctx.save();
        
        discrepancies.forEach(discrepancy => {
            // Skip discrepancies that involve inactive reviewers
            if (discrepancy.reviewers) {
                const allReviewersActive = discrepancy.reviewers.every(reviewer => 
                    activeReviewers[reviewer.reviewerId] || activeReviewers[reviewer.reviewerName]
                );
                
                if (!allReviewersActive) {
                    console.log('Skipping discrepancy for inactive reviewer');
                    return;
                }
            }
            
            // Draw differently based on discrepancy type
            if (discrepancy.type === 'spatial') {
                // Draw both annotations with dashed lines
                ctx.setLineDash([5, 3]);
                ctx.lineWidth = 3;
                
                // Draw outlines for both annotations
                discrepancy.annotations.forEach(annotation => {
                    if (annotation.shapes && annotation.shapes.length > 0) {
                        const shape = annotation.shapes[0];
                        // Use a consistent color for spatial discrepancies
                        drawAnnotationOutline(shape, '#FF0000');
                    }
                });
                
                ctx.setLineDash([]); // Reset dash pattern
            } else if (discrepancy.type === 'classification') {
                // Draw a special marker for classification discrepancies
                const annotation = discrepancy.annotations[0];
                if (annotation.shapes && annotation.shapes.length > 0) {
                    const shape = annotation.shapes[0];
                    const denormalizedShape = denormalizeCoordinates(shape);
                    
                    // First draw the outline with dashed lines
                    ctx.setLineDash([5, 3]);
                    ctx.lineWidth = 3;
                    drawAnnotationOutline(shape, '#FF0000');
                    ctx.setLineDash([]); // Reset dash pattern
                    
                    // Draw a warning icon or text
                    ctx.font = '16px Arial';
                    ctx.fillStyle = '#FF0000';
                    
                    // Position the warning symbol near the annotation
                    const x = denormalizedShape.startX || denormalizedShape.x || 0;
                    const y = denormalizedShape.startY || denormalizedShape.y || 0;
                    
                    ctx.fillText('⚠️', x - 10, y - 10);
                    
                    // Draw a small info box with the conflicting findings
                    if (discrepancy.findings && discrepancy.findings.length >= 2) {
                        ctx.font = '12px Arial';
                        ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
                        ctx.fillRect(x + 10, y - 40, 150, 30);
                        ctx.fillStyle = 'white';
                        ctx.fillText(`${discrepancy.findings[0]} vs ${discrepancy.findings[1]}`, x + 15, y - 20);
                    }
                }
            } else if (discrepancy.type === 'presence') {
                // Draw a highlight around the annotation(s) that only one reviewer marked
                const annotations = discrepancy.annotations;
                const presenceType = discrepancy.presenceType || 'unknown';
                
                // Use different colors based on which reviewer has the unique annotations
                const presenceColor = presenceType === 'unique_to_first' ? '#FFA500' : '#00A5FF';
                
                annotations.forEach(annotation => {
                    if (annotation.shapes && annotation.shapes.length > 0) {
                        const shape = annotation.shapes[0];
                        
                        // Draw with dotted line
                        ctx.setLineDash([2, 2]);
                        ctx.lineWidth = 2;
                        
                        drawAnnotationOutline(shape, presenceColor);
                        
                        ctx.setLineDash([]); // Reset dash pattern
                        
                        // Draw a question mark to indicate missing annotation
                        const denormalizedShape = denormalizeCoordinates(shape);
                        const x = denormalizedShape.startX || denormalizedShape.x || 0;
                        const y = denormalizedShape.startY || denormalizedShape.y || 0;
                        
                        ctx.font = '16px Arial';
                        ctx.fillStyle = presenceColor;
                        ctx.fillText('?', x - 10, y - 10);
                    }
                });
            }
        });
        
        // Restore context state
        ctx.restore();
    }
    
    function updateDiscrepancyCount() {
        const discrepancyCount = document.getElementById('discrepancy-count');
        const discrepancyContainer = document.getElementById('discrepancy-container');
        
        if (discrepancyCount && discrepancyContainer) {
            if (discrepancies.length > 0) {
                discrepancyCount.textContent = discrepancies.length;
                discrepancyContainer.style.display = 'block';
            } else {
                discrepancyContainer.style.display = 'none';
            }
        }
        
        // Update the discrepancy list
        updateDiscrepancyList();
    }
    
    function updateDiscrepancyList() {
        const discrepancyList = document.getElementById('discrepancy-list');
        if (!discrepancyList) return;
        
        // Clear existing list
        discrepancyList.innerHTML = '';
        
        if (discrepancies.length === 0 || !showDiscrepancies) {
            if (!showDiscrepancies) {
                discrepancyList.innerHTML = '<div class="discrepancy-item">Click on "Show Discrepancies" to view discrepancies</div>';
            } else {
                discrepancyList.innerHTML = '<div class="discrepancy-item">No discrepancies detected</div>';
            }
            return;
        }
        
        // Create a list item for each discrepancy
        discrepancies.forEach((discrepancy, index) => {
            const discrepancyItem = document.createElement('div');
            discrepancyItem.className = 'discrepancy-item';
            
            // Create a badge for the discrepancy type
            const typeBadge = document.createElement('span');
            typeBadge.className = 'badge';
            
            // Set badge color based on discrepancy type
            switch (discrepancy.type) {
                case 'spatial':
                    typeBadge.className += ' badge-warning';
                    typeBadge.textContent = 'Spatial';
                    break;
                case 'classification':
                    typeBadge.className += ' badge-danger';
                    typeBadge.textContent = 'Finding';
                    break;
                case 'presence':
                    typeBadge.className += ' badge-info';
                    typeBadge.textContent = 'Presence';
                    break;
                case 'severity':
                    typeBadge.className += ' badge-primary';
                    typeBadge.textContent = 'Severity';
                    break;
                case 'measurement':
                    typeBadge.className += ' badge-secondary';
                    typeBadge.textContent = 'Measurement';
                    break;
                default:
                    typeBadge.className += ' badge-dark';
                    typeBadge.textContent = discrepancy.type;
            }
            
            // Create the discrepancy description
            const description = document.createElement('div');
            description.className = 'discrepancy-description';
            
            // Add appropriate description based on discrepancy type
            switch (discrepancy.type) {
                case 'spatial':
                    description.innerHTML = `
                        <strong>Spatial Discrepancy</strong><br>
                        Between: ${discrepancy.reviewers.join(' and ')}<br>
                        Overlap: ${Math.round(discrepancy.overlap * 100)}%
                    `;
                    break;
                    
                case 'classification':
                    description.innerHTML = `
                        <strong>Finding Discrepancy</strong><br>
                        Between: ${discrepancy.reviewers.join(' and ')}<br>
                        Findings: "${discrepancy.findings[0]}" vs "${discrepancy.findings[1]}"
                    `;
                    break;
                    
                case 'presence':
                    description.innerHTML = `
                        <strong>Presence Discrepancy</strong><br>
                        ${discrepancy.message}
                    `;
                    break;
                    
                case 'severity':
                    description.innerHTML = `
                        <strong>Severity Discrepancy</strong><br>
                        Between: ${discrepancy.reviewers.join(' and ')}<br>
                        Severity: ${discrepancy.severities[0]} vs ${discrepancy.severities[1]}
                    `;
                    break;
                    
                case 'measurement':
                    description.innerHTML = `
                        <strong>Measurement Discrepancy</strong><br>
                        Between: ${discrepancy.reviewers.join(' and ')}<br>
                        Difference: ${Math.round(discrepancy.difference * 100)}%
                    `;
                    break;
                    
                default:
                    description.innerHTML = `
                        <strong>${discrepancy.type} Discrepancy</strong><br>
                        Between: ${discrepancy.reviewers.join(' and ')}
                    `;
            }
            
            // Create focus button
            const focusButton = document.createElement('button');
            focusButton.className = 'btn btn-sm btn-outline-primary focus-discrepancy-btn';
            focusButton.textContent = 'Focus';
            focusButton.onclick = function() {
                focusOnDiscrepancy(index);
            };
            
            // Add elements to the discrepancy item
            discrepancyItem.appendChild(typeBadge);
            discrepancyItem.appendChild(description);
            discrepancyItem.appendChild(focusButton);
            
            // Add the item to the list
            discrepancyList.appendChild(discrepancyItem);
        });
    }
    
    function focusOnDiscrepancy(index) {
        // Get the discrepancy
        const discrepancy = discrepancies[index];
        if (!discrepancy) return;
        
        console.log('Focusing on discrepancy:', discrepancy);
        
        // Get the annotations involved
        let annotations = [];
        if (discrepancy.annotations) {
            annotations = discrepancy.annotations;
        }
        
        if (annotations.length === 0) {
            console.error('No annotations found for this discrepancy');
            return;
        }
        
        // Find the center point of all annotations to focus the view
        let centerX = 0;
        let centerY = 0;
        let count = 0;
        
        annotations.forEach(annotation => {
            if (annotation.shapes && annotation.shapes.length > 0) {
                const shape = annotation.shapes[0];
                const denormalizedShape = denormalizeCoordinates(shape);
                
                // Get center based on shape type
                if (denormalizedShape.type === 'rectangle') {
                    centerX += denormalizedShape.x + denormalizedShape.width / 2;
                    centerY += denormalizedShape.y + denormalizedShape.height / 2;
                    count++;
                } else if (denormalizedShape.type === 'circle') {
                    centerX += denormalizedShape.x;
                    centerY += denormalizedShape.y;
                    count++;
                } else if (denormalizedShape.type === 'line' || denormalizedShape.type === 'arrow') {
                    centerX += (denormalizedShape.startX + denormalizedShape.endX) / 2;
                    centerY += (denormalizedShape.startY + denormalizedShape.endY) / 2;
                    count++;
                } else {
                    // Fallback for other shape types
                    centerX += denormalizedShape.x || denormalizedShape.startX || 0;
                    centerY += denormalizedShape.y || denormalizedShape.startY || 0;
                    count++;
                }
            }
        });
        
        if (count > 0) {
            centerX /= count;
            centerY /= count;
            
            // Log the center point for debugging
            console.log(`Focusing on center point: (${centerX}, ${centerY})`);
            
            // Highlight the annotations by drawing a pulsing outline
            ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
            
            // First redraw all annotations
            redrawAnnotations();
            
            // Then highlight the discrepancy annotations
            annotations.forEach(annotation => {
                // Draw a thick, bright outline around each annotation
                ctx.save(); // Save current context state
                ctx.strokeStyle = '#00FFFF'; // Cyan
                ctx.lineWidth = 3;
                ctx.shadowColor = '#00FFFF';
                ctx.shadowBlur = 10;
                
                // Draw the shape outline based on its type
                if (annotation.region_data) {
                    // Handle backend annotation format
                    annotation.region_data.forEach(shape => {
                        drawAnnotationOutline(shape, '#00FFFF');
                    });
                } else if (annotation.shapes) {
                    // Handle frontend annotation format
                    annotation.shapes.forEach(shape => {
                        drawAnnotationOutline(shape, '#00FFFF');
                    });
                } else {
                    // Try to draw the annotation itself as a shape
                    drawAnnotationOutline(annotation, '#00FFFF');
                }
                
                ctx.restore(); // Restore context state
            });
            
            // Add a pulsing effect
            let pulseSize = 0;
            let growing = true;
            let pulseInterval = setInterval(() => {
                if (growing) {
                    pulseSize += 2;
                    if (pulseSize >= 30) growing = false;
                } else {
                    pulseSize -= 2;
                    if (pulseSize <= 0) growing = true;
                }
                
                // Clear only the area around the center point
                ctx.clearRect(centerX - 40, centerY - 40, 80, 80);
                
                // Redraw the pulse circle
                ctx.beginPath();
                ctx.arc(centerX, centerY, pulseSize, 0, Math.PI * 2);
                ctx.strokeStyle = '#FFFF00';
                ctx.lineWidth = 2;
                ctx.stroke();
                
            }, 50);
            
            // Stop the pulse after 3 seconds
            setTimeout(() => {
                clearInterval(pulseInterval);
                redrawAnnotations();
            }, 3000);
        }
    }
    
    function detectDiscrepancies() {
        console.log('Detecting discrepancies between reviewers');
        
        // Clear existing discrepancies
        discrepancies = [];
        
        // Skip if we don't have enough reviewers or if discrepancies are disabled
        if (!showDiscrepancies) {
            console.log('Discrepancy detection is disabled');
            updateDiscrepancyCount();
            return;
        }
        
        try {
            // Check if we have reviewerAnnotations in the array format
            if (Array.isArray(reviewerAnnotations)) {
                // Get active reviewers
                const activeReviewerAnnotations = reviewerAnnotations.filter(r => 
                    activeReviewers[r.reviewerId] || activeReviewers[r.reviewerName]
                );
                
                // Skip if we don't have at least 2 active reviewers
                if (activeReviewerAnnotations.length < 2) {
                    console.log('Not enough active reviewers to detect discrepancies');
                    updateDiscrepancyCount();
                    return;
                }
                
                console.log('Detecting discrepancies between', activeReviewerAnnotations.length, 'reviewers');
                
                // Compare annotations between each pair of reviewers
                for (let i = 0; i < activeReviewerAnnotations.length; i++) {
                    const reviewer1 = activeReviewerAnnotations[i];
                    
                    for (let j = i + 1; j < activeReviewerAnnotations.length; j++) {
                        const reviewer2 = activeReviewerAnnotations[j];
                        
                        console.log(`Comparing annotations between ${reviewer1.reviewerName} and ${reviewer2.reviewerName}`);
                        
                        // Compare each annotation from reviewer1 with each from reviewer2
                        if (Array.isArray(reviewer1.annotations) && Array.isArray(reviewer2.annotations)) {
                            compareAnnotations(reviewer1, reviewer2);
                        } else {
                            console.error('Invalid annotation format:', reviewer1.annotations, reviewer2.annotations);
                        }
                    }
                }
            } else if (typeof reviewerAnnotations === 'object' && reviewerAnnotations !== null) {
                // Handle the object format of reviewerAnnotations
                const reviewerIds = Object.keys(reviewerAnnotations).filter(id => activeReviewers[id]);
                
                if (reviewerIds.length < 2) {
                    console.log('Not enough active reviewers to detect discrepancies');
                    updateDiscrepancyCount();
                    return;
                }
                
                // Compare annotations between each pair of reviewers
                for (let i = 0; i < reviewerIds.length; i++) {
                    const reviewerId1 = reviewerIds[i];
                    
                    for (let j = i + 1; j < reviewerIds.length; j++) {
                        const reviewerId2 = reviewerIds[j];
                        
                        console.log(`Comparing annotations between Reviewer ${reviewerId1} and Reviewer ${reviewerId2}`);
                        
                        // Create reviewer objects to use with compareAnnotations
                        const reviewer1 = {
                            reviewerId: reviewerId1,
                            reviewerName: `Reviewer ${reviewerId1}`,
                            annotations: reviewerAnnotations[reviewerId1] || []
                        };
                        
                        const reviewer2 = {
                            reviewerId: reviewerId2,
                            reviewerName: `Reviewer ${reviewerId2}`,
                            annotations: reviewerAnnotations[reviewerId2] || []
                        };
                        
                        // Compare annotations
                        if (Array.isArray(reviewer1.annotations) && Array.isArray(reviewer2.annotations)) {
                            compareAnnotations(reviewer1, reviewer2);
                        } else {
                            console.error('Invalid annotation format:', reviewer1.annotations, reviewer2.annotations);
                        }
                    }
                }
            } else {
                console.error('Invalid reviewerAnnotations format:', reviewerAnnotations);
            }
            
            console.log(`Detected ${discrepancies.length} discrepancies`);
        } catch (error) {
            console.error('Error detecting discrepancies:', error);
        }
        
        // Update the discrepancy count display
        updateDiscrepancyCount();
        
        // Redraw to show discrepancies
        redrawAnnotations();
    }
    
    function compareAnnotations(reviewer1, reviewer2) {
        try {
            // Compare each annotation from reviewer1 with each from reviewer2
            reviewer1.annotations.forEach(annotation1 => {
                // Skip annotations not for the current image
                if (annotation1.imageIndex !== currentImageIndex) return;
                
                reviewer2.annotations.forEach(annotation2 => {
                    // Skip annotations not for the current image
                    if (annotation2.imageIndex !== currentImageIndex) return;
                    
                    // Check for spatial overlap
                    const overlap = calculateOverlap(annotation1, annotation2);
                    
                    // If there's significant overlap, check for classification discrepancies
                    if (overlap > 0.3) {
                        // Check if the findings are different
                        const finding1 = (annotation1.finding || '').toLowerCase().trim();
                        const finding2 = (annotation2.finding || '').toLowerCase().trim();
                        
                        if (finding1 && finding2 && finding1 !== finding2) {
                            console.log(`Classification discrepancy found: ${annotation1.finding} vs ${annotation2.finding}`);
                            
                            // Add to discrepancies list
                            discrepancies.push({
                                type: 'classification',
                                annotations: [annotation1, annotation2],
                                findings: [annotation1.finding, annotation2.finding],
                                reviewers: [reviewer1, reviewer2],
                                message: `${reviewer1.reviewerName} marked "${annotation1.finding}" but ${reviewer2.reviewerName} marked "${annotation2.finding}"`
                            });
                        }
                    } 
                    // If there's some overlap but not enough, it might be a spatial discrepancy
                    else if (overlap > 0.1) { // Increased threshold from 0.05 to 0.1
                        console.log(`Spatial discrepancy found: overlap = ${overlap}`);
                        
                        // Add to discrepancies list
                        discrepancies.push({
                            type: 'spatial',
                            annotations: [annotation1, annotation2],
                            overlap: overlap,
                            reviewers: [reviewer1, reviewer2],
                            message: `${reviewer1.reviewerName} and ${reviewer2.reviewerName} marked overlapping regions (${Math.round(overlap * 100)}% overlap)`
                        });
                    }
                    // Check for finding discrepancies even with minimal spatial overlap
                    // This allows detection of different diagnoses in the same general area
                    else if (overlap > 0 && overlap <= 0.1) {
                        const finding1 = (annotation1.finding || '').toLowerCase().trim();
                        const finding2 = (annotation2.finding || '').toLowerCase().trim();
                        
                        if (finding1 && finding2 && finding1 !== finding2) {
                            console.log(`Finding discrepancy with minimal overlap: ${annotation1.finding} vs ${annotation2.finding}`);
                            
                            // Add to discrepancies list
                            discrepancies.push({
                                type: 'classification',
                                annotations: [annotation1, annotation2],
                                findings: [annotation1.finding, annotation2.finding],
                                reviewers: [reviewer1, reviewer2],
                                message: `${reviewer1.reviewerName} marked "${annotation1.finding}" but ${reviewer2.reviewerName} marked "${annotation2.finding}" in nearby areas`
                            });
                        }
                    }
                });
                
                // Check for presence/absence discrepancies
                // If annotation1 doesn't significantly overlap with any of reviewer2's annotations,
                // it might be a presence/absence discrepancy
                const hasOverlap = reviewer2.annotations.some(annotation2 => {
                    if (annotation2.imageIndex !== currentImageIndex) return false;
                    return calculateOverlap(annotation1, annotation2) > 0.3;
                });
                
                if (!hasOverlap) {
                    console.log(`Presence discrepancy found: ${reviewer1.reviewerName} marked something that ${reviewer2.reviewerName} didn't`);
                    
                    // Add to discrepancies list
                    discrepancies.push({
                        type: 'presence',
                        annotations: [annotation1],
                        reviewers: [reviewer1, reviewer2],
                        message: `${reviewer1.reviewerName} marked a finding that ${reviewer2.reviewerName} did not`
                    });
                }
            });
            
            // Check for annotations that reviewer2 has but reviewer1 doesn't
            reviewer2.annotations.forEach(annotation2 => {
                // Skip annotations not for the current image
                if (annotation2.imageIndex !== currentImageIndex) return;
                
                const hasOverlap = reviewer1.annotations.some(annotation1 => {
                    if (annotation1.imageIndex !== currentImageIndex) return false;
                    return calculateOverlap(annotation1, annotation2) > 0.3;
                });
                
                if (!hasOverlap) {
                    console.log(`Presence discrepancy found: ${reviewer2.reviewerName} marked something that ${reviewer1.reviewerName} didn't`);
                    
                    // Add to discrepancies list
                    discrepancies.push({
                        type: 'presence',
                        annotations: [annotation2],
                        reviewers: [reviewer1, reviewer2],
                        message: `${reviewer2.reviewerName} marked a finding that ${reviewer1.reviewerName} did not`
                    });
                }
            });
        } catch (error) {
            console.error('Error comparing annotations:', error);
        }
    }
    
    function updateCanvasPosition() {
        // Store the current scroll position
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        
        // Get the canvas position relative to the viewport
        const canvasRect = annotationCanvas.getBoundingClientRect();
        
        // Update image position for coordinate calculations
        // Add scroll position to get absolute position
        imageLeft = canvasRect.left + scrollX;
        imageTop = canvasRect.top + scrollY;
        
        console.log(`Updated canvas position: left=${imageLeft}, top=${imageTop}`);
    }
});

function getMeasurement(annotation) {
    // Extract measurement from an annotation if available
    if (!annotation || !annotation.shapes || annotation.shapes.length === 0) {
        return null;
    }
    
    const shape = annotation.shapes[0];
    const type = shape.type || shape.tool;
    
    // Different measurement types based on shape
    switch (type) {
        case 'rectangle':
            // Area measurement for rectangles
            const width = shape.width || (shape.endX - shape.startX) || 0;
            const height = shape.height || (shape.endY - shape.startY) || 0;
            return width * height;
            
        case 'circle':
        case 'ellipse':
            // Area measurement for circles
            let radius = shape.radius;
            if (radius === undefined) {
                // Calculate from start/end points if available
                if (shape.endX !== undefined) {
                    radius = Math.sqrt(
                        Math.pow(shape.endX - shape.startX, 2) + 
                        Math.pow(shape.endY - shape.startY, 2)
                    );
                } else {
                    radius = Math.max(shape.radiusX || 0, shape.radiusY || 0);
                }
            }
            return Math.PI * radius * radius;
            
        case 'line':
        case 'arrow':
            // Length measurement for lines
            return Math.sqrt(
                Math.pow(shape.endX - shape.startX, 2) + 
                Math.pow(shape.endY - shape.startY, 2)
            );
            
        default:
            return null;
    }
}

function drawAnnotationOutline(shape, color) {
    // Set default color if not provided
    color = color || '#FF0000';
    
    // Set drawing style
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    // Draw outline based on shape type
    switch (shape.type) {
        case 'rectangle':
            // Draw rectangle outline
            ctx.beginPath();
            ctx.rect(
                shape.x,
                shape.y,
                shape.width,
                shape.height
            );
            ctx.stroke();
            break;
            
        case 'circle':
            // Draw circle outline
            ctx.beginPath();
            ctx.arc(
                shape.x,
                shape.y,
                shape.radius,
                0,
                Math.PI * 2
            );
            ctx.stroke();
            break;
            
        case 'line':
            // Draw line
            ctx.beginPath();
            ctx.moveTo(shape.startX, shape.startY);
            ctx.lineTo(shape.endX, shape.endY);
            ctx.stroke();
            break;
            
        case 'arrow':
            // Draw arrow line
            ctx.beginPath();
            ctx.moveTo(shape.startX, shape.startY);
            ctx.lineTo(shape.endX, shape.endY);
            ctx.stroke();
            
            // Draw arrow head
            const angle = Math.atan2(shape.endY - shape.startY, shape.endX - shape.startX);
            const headlen = 15; // Length of arrow head
            
            ctx.beginPath();
            ctx.moveTo(shape.endX, shape.endY);
            ctx.lineTo(
                shape.endX - headlen * Math.cos(angle - Math.PI / 6),
                shape.endY - headlen * Math.sin(angle - Math.PI / 6)
            );
            ctx.moveTo(shape.endX, shape.endY);
            ctx.lineTo(
                shape.endX - headlen * Math.cos(angle + Math.PI / 6),
                shape.endY - headlen * Math.sin(angle + Math.PI / 6)
            );
            ctx.stroke();
            break;
            
        case 'polygon':
            // Draw polygon outline
            if (shape.points && shape.points.length > 0) {
                ctx.beginPath();
                ctx.moveTo(shape.points[0].x, shape.points[0].y);
                
                for (let i = 1; i < shape.points.length; i++) {
                    ctx.lineTo(shape.points[i].x, shape.points[i].y);
                }
                
                ctx.closePath();
                ctx.stroke();
            }
            break;
            
        case 'freehand':
            // Draw freehand outline
            if (shape.points && shape.points.length > 0) {
                ctx.beginPath();
                ctx.moveTo(shape.points[0].x, shape.points[0].y);
                
                for (let i = 1; i < shape.points.length; i++) {
                    ctx.lineTo(shape.points[i].x, shape.points[i].y);
                }
                
                if (shape.closed) {
                    ctx.closePath();
                }
                
                ctx.stroke();
            }
            break;
            
        case 'ellipse':
            // Draw ellipse outline
            ctx.beginPath();
            ctx.ellipse(
                shape.x,
                shape.y,
                shape.radiusX,
                shape.radiusY,
                shape.rotation || 0,
                0,
                Math.PI * 2
            );
            ctx.stroke();
            break;
            
        case 'text':
            // Draw text outline (just a rectangle around the text)
            ctx.beginPath();
            ctx.rect(
                shape.x,
                shape.y,
                shape.width || 100,
                shape.height || 20
            );
            ctx.stroke();
            break;
            
        case 'point':
            // Draw point as a small circle
            ctx.beginPath();
            ctx.arc(
                shape.x,
                shape.y,
                5, // Small radius for point
                0,
                Math.PI * 2
            );
            ctx.stroke();
            break;
    }
}

function focusOnDiscrepancy(discrepancy) {
    console.log('Focusing on discrepancy:', discrepancy);
    
    // Get the annotations involved in this discrepancy
    const annotations = discrepancy.annotations || [];
    
    if (annotations.length === 0) {
        console.warn('No annotations to focus on');
        return;
    }
    
    // Calculate the center point of all annotations
    let centerX = 0;
    let centerY = 0;
    let count = 0;
    
    annotations.forEach(annotation => {
        // Get the center of each annotation's bounding box
        const shape = annotation.shapes && annotation.shapes.length > 0 ? annotation.shapes[0] : null;
        if (shape) {
            const denormalizedShape = denormalizeCoordinates(shape);
            const bbox = getBoundingBox(denormalizedShape);
            
            // Calculate center based on shape type
            const type = shape.type || shape.tool;
            let x, y;
            
            if (type === 'rectangle') {
                x = bbox.startX + (bbox.endX - bbox.startX) / 2;
                y = bbox.startY + (bbox.endY - bbox.startY) / 2;
            } else if (type === 'circle' || type === 'ellipse') {
                x = denormalizedShape.startX || denormalizedShape.x || 0;
                y = denormalizedShape.startY || denormalizedShape.y || 0;
            } else if (type === 'line' || type === 'arrow') {
                x = (denormalizedShape.startX + denormalizedShape.endX) / 2;
                y = (denormalizedShape.startY + denormalizedShape.endY) / 2;
            } else {
                // Default to using the start coordinates
                x = denormalizedShape.startX || denormalizedShape.x || 0;
                y = denormalizedShape.startY || denormalizedShape.y || 0;
            }
            
            centerX += x;
            centerY += y;
            count++;
        }
    });
    
    if (count > 0) {
        centerX /= count;
        centerY /= count;
        
        // Log the center point for debugging
        console.log(`Focusing on center point: (${centerX}, ${centerY})`);
        
        // Highlight the annotations by drawing a pulsing outline
        ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
        
        // First redraw all annotations
        redrawAnnotations();
        
        // Then highlight the discrepancy annotations
        annotations.forEach(annotation => {
            // Draw a thick, bright outline around each annotation
            ctx.save();
            
            // Use different colors based on discrepancy type
            let highlightColor = '#00FFFF'; // Default cyan
            
            if (discrepancy.type === 'classification') {
                highlightColor = '#FF00FF'; // Magenta for classification
            } else if (discrepancy.type === 'presence') {
                // Use different colors based on which reviewer has the unique annotations
                highlightColor = discrepancy.presenceType === 'unique_to_first' ? '#FFA500' : '#00A5FF';
            }
            
            ctx.strokeStyle = highlightColor;
            ctx.lineWidth = 3;
            ctx.shadowColor = highlightColor;
            ctx.shadowBlur = 10;
            
            // Draw the shape outline based on its type
            if (annotation.region_data) {
                // Handle backend annotation format
                annotation.region_data.forEach(shape => {
                    drawAnnotationOutline(shape, highlightColor);
                });
            } else if (annotation.shapes) {
                // Handle frontend annotation format
                annotation.shapes.forEach(shape => {
                    drawAnnotationOutline(shape, highlightColor);
                });
            } else {
                // Try to draw the annotation itself as a shape
                drawAnnotationOutline(annotation, highlightColor);
            }
            
            ctx.restore();
        });
        
        // Add a pulsing effect
        let pulseSize = 0;
        let growing = true;
        let pulseInterval = setInterval(() => {
            if (growing) {
                pulseSize += 2;
                if (pulseSize >= 30) growing = false;
            } else {
                pulseSize -= 2;
                if (pulseSize <= 0) growing = true;
            }
            
            // Clear only the area around the center point
            ctx.clearRect(centerX - 40, centerY - 40, 80, 80);
            
            // Redraw the pulse circle with color based on discrepancy type
            ctx.beginPath();
            ctx.arc(centerX, centerY, pulseSize, 0, Math.PI * 2);
            
            // Use different colors based on discrepancy type
            if (discrepancy.type === 'classification') {
                ctx.strokeStyle = '#FF00FF'; // Magenta for classification
            } else if (discrepancy.type === 'presence') {
                // Use different colors based on which reviewer has the unique annotations
                ctx.strokeStyle = discrepancy.presenceType === 'unique_to_first' ? '#FFA500' : '#00A5FF';
            } else {
                ctx.strokeStyle = '#FFFF00'; // Yellow for spatial
            }
            
            ctx.lineWidth = 2;
            ctx.stroke();
            
        }, 50);
        
        // Stop the pulse after 3 seconds
        setTimeout(() => {
            clearInterval(pulseInterval);
            redrawAnnotations();
        }, 3000);
    }
}
