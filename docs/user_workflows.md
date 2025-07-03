# 6. User Workflows

This section documents the key user workflows within the DICOM Multi-Reviewer System, providing a comprehensive guide to how different user roles interact with the system to accomplish their tasks.

## 6.1 User Role Overview

The system supports two primary user roles, each with distinct permissions and capabilities:

### Administrator Role

Administrators have system access with the following capabilities:
- View all studies in the system
- View annotations from all radiologists
- Access the consensus comparison viewer

### Radiologist Role

Radiologists are the primary end-users who:
- Review DICOM studies
- Create and edit annotations
- Participate in consensus comparisons
- View their own annotation history

## 6.2 Authentication Workflows

### User Login

```mermaid
sequenceDiagram
    participant U as User
    participant S as System
    participant DB as Database
    
    U->>S: Navigate to Login Page
    S->>U: Display Login Form
    U->>S: Enter Username and Password
    U->>S: Submit Form
    S->>DB: Query User Record
    DB->>S: Return User Data
    S->>S: Verify Password Hash
    alt Authentication Successful
        S->>S: Generate Session Token
        S->>DB: Store Session
        S->>U: Set Session Cookie
        S->>U: Redirect to Dashboard
    else Authentication Failed
        S->>U: Display Error Message
        S->>U: Prompt to Try Again
    end
```

**Explanation:** This diagram illustrates the login process. Users enter their credentials on the login page, which are verified against the database. If authentication is successful, a session token is generated and stored, and the user is redirected to the dashboard. If authentication fails, an error message is displayed, and the user is prompted to try again.

## 6.3 Study Management Workflows

### Accessing Available Studies

```mermaid
sequenceDiagram
    participant U as User
    participant S as System
    participant FS as File System
    
    U->>S: Navigate to Study List
    S->>FS: Scan DICOM Directory
    FS->>S: Return Available Studies
    S->>S: Process Study Metadata
    S->>U: Display Study List Table
    U->>S: Apply Filters (Optional)
    U->>U: Update Study List
    U->>S: Select Study to View
    S->>U: Redirect to DICOM Viewer
```

**Explanation:** This workflow shows how users access available DICOM studies. The system scans the configured DICOM directory to find available studies, processes the metadata, and presents them in a table format. Users can optionally filter the list and select a study to view, which redirects them to the DICOM viewer.

## 6.4 DICOM Viewing and Annotation Workflows

### Accessing Studies

```mermaid
sequenceDiagram
    participant R as Radiologist
    participant S as System
    participant FS as File System
    
    R->>S: Log in to System
    S->>R: Display Dashboard
    R->>S: Navigate to Study List
    S->>FS: Scan DICOM Directory
    FS->>S: Return Available Studies
    S->>R: Display Study Worklist
    R->>S: Select Study to Review
    S->>FS: Load Study Data
    S->>R: Redirect to DICOM Viewer
```

**Explanation:** This diagram shows how radiologists access studies for review. After logging in, they navigate to the study list where the system scans the DICOM directory and displays available studies. When a radiologist selects a study, the system loads the study data from the file system and redirects to the DICOM viewer.

### Creating Annotations

```mermaid
sequenceDiagram
    participant R as Radiologist
    participant V as DICOM Viewer
    participant S as System
    participant DB as Database
    
    R->>V: Navigate Through DICOM Series
    V->>R: Display Current Image
    R->>V: Select Annotation Tool
    R->>V: Draw Region of Interest
    V->>R: Display Annotation Controls
    R->>V: Enter Finding Description
    R->>V: Set Confidence Level
    R->>V: Add Notes (Optional)
    R->>V: Click "Save Annotation"
    V->>S: Send Annotation Data
    S->>S: Validate Annotation
    S->>DB: Store Annotation
    S->>V: Confirm Successful Save
    V->>R: Update Annotation List
```

**Explanation:** This workflow depicts the annotation creation process. Radiologists navigate through DICOM images, select an annotation tool, and draw regions of interest. They then enter metadata such as finding description, confidence level, and optional notes. When they save the annotation, the data is validated and stored in the database, and the annotation list is updated in the viewer.

### Editing Existing Annotations

```mermaid
sequenceDiagram
    participant R as Radiologist
    participant V as DICOM Viewer
    participant S as System
    participant DB as Database
    
    R->>V: View Existing Annotations
    V->>R: Display Annotation List
    R->>V: Select Annotation to Edit
    V->>S: Request Annotation Data
    S->>DB: Query Annotation
    DB->>S: Return Annotation Details
    S->>V: Load Annotation
    V->>R: Highlight Selected Annotation
    R->>V: Modify Annotation (Region, Description, Confidence)
    R->>V: Click "Update Annotation"
    V->>S: Send Updated Data
    S->>DB: Update Annotation Record
    S->>V: Confirm Successful Update
    V->>R: Refresh Annotation Display
```

**Explanation:** This diagram shows how radiologists edit existing annotations. They select an annotation from the list, which loads the annotation data from the database. The selected annotation is highlighted, allowing the radiologist to modify its properties. When they submit the update, the changes are saved to the database and the display is refreshed.

### Completing a Study Review

```mermaid
sequenceDiagram
    participant R as Radiologist
    participant V as DICOM Viewer
    participant S as System
    participant DB as Database
    
    R->>V: Review All Images in Study
    V->>R: Display Annotation Summary
    R->>V: Verify Annotations
    R->>V: Click "Complete Review"
    V->>R: Display Confirmation Dialog
    R->>V: Confirm Completion
    V->>S: Send Completion Request
    S->>DB: Update Study Status
    S->>DB: Record Completion Timestamp
    S->>V: Display Completion Confirmation
    V->>R: Redirect to Dashboard
```

**Explanation:** This workflow illustrates the process of completing a study review. After reviewing all images and verifying annotations, the radiologist marks the review as complete. The system updates the study status in the database, records the completion timestamp, and redirects the radiologist back to the dashboard.

## 6.5 Consensus Workflows

### Implementation Status Overview

> **Note:** The consensus workflows are currently **partially implemented**. This section documents both the implemented features and those planned for future development.

| Feature | Status | Notes |
|---------|--------|-------|
| ✅ Consensus Dashboard UI | Implemented | Basic UI showing studies with multiple reviews |
| ✅ Study Selection | Implemented | Ability to select studies for comparison |
| ✅ Side-by-side Annotation View | Implemented | Basic viewing of annotations from different reviewers |
| ⚠️ Basic Discrepancy Detection | Partial | Limited to finding differences without advanced spatial analysis |
| ❌ Discussion Thread | Planned | Not yet implemented |
| ❌ Voting System | Planned | Not yet implemented |
| ❌ Consensus Resolution | Planned | Not yet implemented |
| ❌ Statistics and Reporting | Planned | Not yet implemented |

### Accessing the Consensus Dashboard (Implemented)

```mermaid
sequenceDiagram
    participant A as Administrator
    participant S as System
    participant DB as Database
    
    A->>S: Navigate to Consensus Dashboard
    S->>DB: Query Studies with Multiple Reviews
    DB->>S: Return Multi-Review Studies
    S->>A: Display Study List
    A->>S: Select Study for Comparison
    S->>DB: Retrieve All Annotations for Study
    DB->>S: Return Annotations by Reviewer
    S->>S: Process Annotations
    S->>S: Basic Discrepancy Detection
    S->>A: Display Side-by-Side View
```

**Explanation:** This diagram shows the currently implemented workflow for accessing the consensus dashboard. Administrators can view studies with multiple reviews and select one for comparison. The system retrieves annotations and displays them side-by-side with basic discrepancy detection.

### Resolving Discrepancies (Planned - Not Yet Implemented)

```mermaid
sequenceDiagram
    participant A as Administrator
    participant S as System
    participant R as Radiologists
    participant DB as Database
    
    A->>S: Identify Discrepancy
    A->>S: Initiate Discussion
    S->>R: Send Notification
    R->>S: View Discrepancy
    R->>S: Add Comments
    A->>S: Review Comments
    A->>S: Propose Resolution
    R->>S: Vote on Resolution
    S->>S: Calculate Consensus
    S->>DB: Store Consensus Result
    S->>A: Display Consensus Result
    
    style A stroke:#666,stroke-width:2px
    style S stroke:#666,stroke-width:2px
    style R stroke:#666,stroke-width:2px
    style DB stroke:#666,stroke-width:2px
```

**Explanation:** This workflow illustrates the planned (but not yet implemented) process for resolving discrepancies. The diagram is shown in gray to indicate that this functionality is not currently available in the system.

## 6.6 Future Planned Workflows

The following workflows represent planned functionality for future versions of the system:

1. **User Management Interface**: An administrative interface for creating and managing user accounts
2. **DICOM Upload Interface**: A user interface for uploading new DICOM studies to the system
3. **Consensus Discussion and Voting**: Formal tools for discussing and voting on annotation discrepancies
4. **Reporting and Analytics**: Statistical reports and performance metrics
5. **System Configuration Interface**: Administrative tools for configuring system settings
