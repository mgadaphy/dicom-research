// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing viewer");
    
    // Register our own image loader
    cornerstone.registerImageLoader('myCustomLoader', function(imageId) {
        const url = imageId.substring('myCustomLoader:'.length);
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch DICOM file');
                }
                return response.arrayBuffer();
            })
            .then(arrayBuffer => {
                const dicomData = new Uint8Array(arrayBuffer);
                const dataSet = dicomParser.parseDicom(dicomData);
                const pixelDataElement = dataSet.elements.x7fe00010; // Pixel Data tag
                const pixelData = new Uint8Array(dataSet.byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length);

                const rows = dataSet.uint16('x00280010'); // Rows
                const columns = dataSet.uint16('x00280011'); // Columns;

                return {
                    imageId: imageId,
                    minPixelValue: Math.min(...pixelData),
                    maxPixelValue: Math.max(...pixelData),
                    slope: 1.0,
                    intercept: 0,
                    windowCenter: 127,
                    windowWidth: 256,
                    getPixelData: () => pixelData,
                    rows: rows,
                    columns: columns,
                    height: rows,
                    width: columns,
                    color: false,
                    columnPixelSpacing: 1.0,
                    rowPixelSpacing: 1.0,
                    sizeInBytes: rows * columns
                };
            });
    });
    
    // Initialize the viewer
    const element = document.getElementById('dicom-viewer');
    cornerstone.enable(element);
    
    // Load a test image
    cornerstone.loadImage('myCustomLoader:testImage').then(function(image) {
        console.log("Test image loaded successfully");
        cornerstone.displayImage(element, image);
        
        // Update study info with test data
        document.getElementById('patient-id').textContent = 'TEST001';
        document.getElementById('patient-name').textContent = 'Test Patient';
        document.getElementById('study-date').textContent = '2023-03-22';
        document.getElementById('modality').textContent = 'MR';
        document.getElementById('series-description').textContent = 'Test Series';
        
        // Setup window width/center controls
        setupControls(element);
    }).catch(function(err) {
        console.error("Error loading test image:", err);
        alert("Failed to load test image: " + err.message);
    });
    
    // Load a DICOM image
    const studyUid = '1.2.840.113619.2.55.3.604688.1.1.1';
    const seriesUid = '1.2.840.113619.2.55.3.604688.1.1.2';
    const instanceUid = '1.2.840.113619.2.55.3.604688.1.1.3';
    cornerstone.loadImage(`myCustomLoader:/api/dicom/${studyUid}/${seriesUid}/${instanceUid}/file`)
        .then(function(image) {
            cornerstone.displayImage(element, image);
        })
        .catch(function(err) {
            console.error("Error loading DICOM image:", err);
        });
    
    // Setup controls for the viewer
    function setupControls(element) {
        // Window width/center controls
        document.getElementById('window-width').addEventListener('input', function() {
            const viewport = cornerstone.getViewport(element);
            viewport.voi.windowWidth = Number(this.value);
            cornerstone.setViewport(element, viewport);
        });
        
        document.getElementById('window-center').addEventListener('input', function() {
            const viewport = cornerstone.getViewport(element);
            viewport.voi.windowCenter = Number(this.value);
            cornerstone.setViewport(element, viewport);
        });
        
        // Zoom buttons
        document.getElementById('zoom-in').addEventListener('click', function() {
            const viewport = cornerstone.getViewport(element);
            viewport.scale += 0.25;
            cornerstone.setViewport(element, viewport);
        });
        
        document.getElementById('zoom-out').addEventListener('click', function() {
            const viewport = cornerstone.getViewport(element);
            viewport.scale -= 0.25;
            cornerstone.setViewport(element, viewport);
        });
        
        document.getElementById('reset-view').addEventListener('click', function() {
            cornerstone.reset(element);
        });
    }
});