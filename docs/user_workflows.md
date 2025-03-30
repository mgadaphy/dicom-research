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

## 6.5 Consensus Workflows

### Accessing the Consensus Comparison Viewer

```mermaid
sequenceDiagram
    participant R as Radiologist
    participant S as System
    participant V as Consensus Viewer
    participant DB as Database
    
    R->>S: Navigate to Study List
    S->>R: Display Available Studies
    R->>S: Select Study with Multiple Reviews
    S->>DB: Query Study Annotations
    DB->>S: Return Annotation Data
    S->>R: Display Consensus Option
    R->>S: Click "View Consensus"
    S->>V: Load Consensus Viewer
    V->>DB: Query Annotations
    DB->>V: Return All Reviewers' Annotations
    V->>R: Display Side-by-Side Comparison
    R->>V: Review Annotation Differences
```

### Reviewing Discrepancies

```mermaid
sequenceDiagram
    participant R as Radiologist
    participant V as Consensus Viewer
    participant S as System
    participant DB as Database
    
    R->>V: View Side-by-Side Annotations
    V->>S: Calculate Discrepancies
    S->>V: Return Discrepancy List
    V->>R: Display Discrepancy Summary
    R->>V: Select Discrepancy
    V->>R: Focus View on Selected Discrepancy
    R->>V: Navigate Between Discrepancies
    R->>V: Compare Annotation Details
```

## 6.6 Future Planned Workflows

The following workflows represent planned functionality for future versions of the system:

1. **User Management Interface**: An administrative interface for creating and managing user accounts
2. **DICOM Upload Interface**: A user interface for uploading new DICOM studies to the system
3. **Consensus Discussion and Voting**: Formal tools for discussing and voting on annotation discrepancies
4. **Reporting and Analytics**: Statistical reports and performance metrics
5. **System Configuration Interface**: Administrative tools for configuring system settings
