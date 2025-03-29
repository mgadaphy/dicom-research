class DicomLoader {
    constructor() {
        this.metadata = null;
    }

    async loadMetadata(studyUid, seriesUid, instanceUid) {
        try {
            const response = await fetch(`/api/dicom/${studyUid}/${seriesUid}/${instanceUid}`);
            if (!response.ok) {
                throw new Error('Failed to load DICOM metadata');
            }
            
            this.metadata = await response.json();
            return this.metadata;
        } catch (error) {
            console.error('Error loading DICOM metadata:', error);
            throw error;
        }
    }
}