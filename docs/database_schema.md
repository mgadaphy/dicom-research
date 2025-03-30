# 4. Database Schema

## 4.1 Database Structure

The DICOM Multi-Reviewer System uses SQLite as its database engine, providing a lightweight yet powerful storage solution. This section documents the complete database schema, including all tables, relationships, and key fields.

### Database Tables Overview

The database consists of several interconnected tables that store user information, study metadata, and annotations:

```mermaid
erDiagram
  USERS {
    int id PK
    string username
    string password_hash
    string email
    string full_name
    string role
    datetime created_at
    datetime last_login
  }
  
  SESSIONS {
    int id PK
    int user_id FK
    string session_token
    datetime created_at
    datetime expires_at
  }
  
  ANNOTATIONS {
    string id PK
    string study_uid
    string series_uid
    string instance_uid
    int reviewer_id FK
    string finding
    float confidence_level
    text notes
    string consensus_status
    float consensus_score
    boolean is_consensus_result
    text region_data
    datetime created_at
    datetime updated_at
  }
  
  CONSENSUS_SESSIONS {
    string id PK
    string title
    text description
    string study_uid
    datetime created_at
    datetime updated_at
    string status
    int creator_id FK
  }
  
  CONSENSUS_ANNOTATION_ASSOCIATION {
    string session_id FK
    string annotation_id FK
  }
  
  CONSENSUS_REVIEWER_ASSOCIATION {
    string session_id FK
    int reviewer_id FK
  }
  
  USERS ||--o{ SESSIONS : has
  USERS ||--o{ ANNOTATIONS : creates
  USERS ||--o{ CONSENSUS_SESSIONS : creates
  
  ANNOTATIONS }|--o{ CONSENSUS_SESSIONS : included_in
  
  CONSENSUS_SESSIONS }|--o{ USERS : includes
```

### Users Table

The `users` table stores information about system users, including authentication details and role assignments:

```python
# From user.py
class User(db.Model, UserMixin):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    full_name = db.Column(db.String(150), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='radiologist')
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
```

Key fields:
- `id`: Primary key, auto-incrementing integer
- `username`: Unique username for login
- `password_hash`: Bcrypt-hashed password
- `email`: Unique email address
- `full_name`: User's full name
- `role`: User role ('admin' or 'radiologist')
- `created_at`: Account creation timestamp
- `last_login`: Last login timestamp

### Sessions Table

The `sessions` table manages persistent user sessions:

```python
# From user.py
class Session(db.Model):
    __tablename__ = 'sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    session_token = db.Column(db.String(128), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    
    user = db.relationship('User', backref=db.backref('sessions', lazy=True))
```

Key fields:
- `id`: Primary key, auto-incrementing integer
- `user_id`: Foreign key to the users table
- `session_token`: Unique token for session identification
- `created_at`: Session creation timestamp
- `expires_at`: Session expiration timestamp

### Annotations Table

The `annotations` table stores all user annotations and their metadata:

```python
# From annotation.py
class Annotation(db.Model):
    __tablename__ = 'annotations'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    study_uid = db.Column(db.String(64), nullable=False, index=True)
    series_uid = db.Column(db.String(64), nullable=True)
    instance_uid = db.Column(db.String(64), nullable=True)
    
    # Foreign key relationship with user
    reviewer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    reviewer = db.relationship('User', backref=db.backref('annotations', lazy=True))
    
    # Annotation metadata
    finding = db.Column(db.String(255), nullable=True)
    confidence_level = db.Column(db.Float, default=0.0)
    notes = db.Column(db.Text, nullable=True)
    
    # Consensus-related fields
    consensus_status = db.Column(db.String(20), default='pending')  # pending, agreed, disputed
    consensus_score = db.Column(db.Float, default=0.0)  # Agreement score (0-1)
    is_consensus_result = db.Column(db.Boolean, default=False)  # Whether this annotation is a consensus result
    
    # Annotation data (stored as JSON)
    _region_data = db.Column('region_data', db.Text, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
```

Key fields:
- `id`: Primary key, UUID string
- `study_uid`, `series_uid`, `instance_uid`: DICOM identifiers
- `reviewer_id`: Foreign key to the users table
- `finding`: Text description of the radiological finding
- `confidence_level`: Numeric confidence rating (0-10)
- `notes`: Additional notes about the finding
- `consensus_status`: Status in consensus review process
- `consensus_score`: Agreement score in consensus review
- `is_consensus_result`: Flag for consensus result annotations
- `region_data`: JSON-encoded shape data
- `created_at`, `updated_at`: Timestamps

### Consensus Sessions Table

The `consensus_sessions` table tracks consensus review sessions:

```python
# From consensus.py
class ConsensusSession(db.Model):
    __tablename__ = 'consensus_sessions'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    study_uid = db.Column(db.String(64), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status = db.Column(db.String(20), default='active')  # active, completed, archived
    
    # Creator of the consensus session
    creator_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    creator = relationship('User', foreign_keys=[creator_id])
    
    # Many-to-many relationship with annotations
    annotations = db.relationship('Annotation', 
                                secondary='consensus_annotation_association',
                                backref=db.backref('consensus_sessions', lazy='dynamic'))
    
    # Many-to-many relationship with reviewers (users)
    reviewers = db.relationship('User',
                               secondary='consensus_reviewer_association',
                               backref=db.backref('consensus_sessions', lazy='dynamic'))
```

Key fields:
- `id`: Primary key, UUID string
- `title`: Session title
- `description`: Session description
- `study_uid`: DICOM study identifier
- `created_at`, `updated_at`: Timestamps
- `status`: Session status
- `creator_id`: Foreign key to the users table
- Relationships to annotations and reviewers

### Association Tables

The system uses two association tables for many-to-many relationships:

```python
# From consensus.py
# Association between consensus sessions and annotations
consensus_annotation_association = db.Table('consensus_annotation_association',
    db.Column('session_id', db.String(36), db.ForeignKey('consensus_sessions.id'), primary_key=True),
    db.Column('annotation_id', db.String(36), db.ForeignKey('annotations.id'), primary_key=True)
)

# Association between consensus sessions and reviewers
consensus_reviewer_association = db.Table('consensus_reviewer_association',
    db.Column('session_id', db.String(36), db.ForeignKey('consensus_sessions.id'), primary_key=True),
    db.Column('reviewer_id', db.Integer, db.ForeignKey('users.id'), primary_key=True)
)
```

These tables enable:
- Many-to-many relationship between consensus sessions and annotations
- Many-to-many relationship between consensus sessions and reviewers (users)

### Table Relationships

The database schema includes several key relationships:

1. **User to Annotations**: One-to-many relationship where each user can create multiple annotations
   ```python
   reviewer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
   reviewer = db.relationship('User', backref=db.backref('annotations', lazy=True))
   ```

2. **User to Sessions**: One-to-many relationship where each user can have multiple login sessions
   ```python
   user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
   user = db.relationship('User', backref=db.backref('sessions', lazy=True))
   ```

3. **Session to Annotations**: Many-to-many relationship through the consensus_annotation_association table
   ```python
   annotations = db.relationship('Annotation', 
                               secondary='consensus_annotation_association',
                               backref=db.backref('consensus_sessions', lazy='dynamic'))
   ```

4. **Session to Reviewers**: Many-to-many relationship through the consensus_reviewer_association table
   ```python
   reviewers = db.relationship('User',
                              secondary='consensus_reviewer_association',
                              backref=db.backref('consensus_sessions', lazy='dynamic'))
   ```

This database schema provides a solid foundation for the DICOM Multi-Reviewer System, enabling persistent storage of user data, annotations, and consensus information while maintaining proper relationships between different entities.
