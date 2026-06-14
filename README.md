# OpsFlow API

OpsFlow API adalah REST API berbasis NestJS yang dirancang untuk membantu tim engineering mengelola project, task, dan deployment dalam satu platform terpusat.

Project ini dibuat sebagai simulasi workflow operasional yang umum digunakan oleh tim backend dan cloud engineering, mulai dari pengelolaan project, assignment task, hingga pelacakan deployment dan notifikasi otomatis melalui Telegram Bot.

---

## Features

- JWT Authentication
- Role-Based Access Control (RBAC)
- Project Management
- Task Management
- Deployment Tracking
- Telegram Notification Integration
- Swagger API Documentation
- End-to-End Testing (E2E Testing)

---

## Technology Stack

| Technology | Description |
|------------|-------------|
| NestJS | Backend Framework |
| TypeScript | Programming Language |
| PostgreSQL | Relational Database |
| Prisma ORM | ORM & Database Migration |
| Swagger | API Documentation |
| JWT | Authentication |
| Telegram Bot API | Deployment Notification |
| Jest | Unit & E2E Testing |
| Docker | Containerization |

---

## Architecture Pattern

This project uses a **Feature-Based Modular Architecture**, which is the recommended architecture pattern in NestJS.

Each feature is organized into its own module:

```text
src/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── workspaces/
│   ├── projects/
│   ├── tasks/
│   ├── deployments/
│   ├── notifications/
│   ├── audit/
│   ├── status-history/
│   └── prisma/
│
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── interceptors/
│   ├── filters/
│   ├── enums/
│   └── constants/
│
├── config/
├── integrations/
│   └── telegram/
│
├── jobs/
│   └── deployment.queue.ts
│
└── main.ts
```

### Why Feature-Based Architecture?

This architecture was chosen because:

- Clear separation of concerns
- Easy to maintain and scale
- Independent feature development
- Aligns with NestJS module system
- Suitable for medium to large applications

Each feature contains its own:

- Controller
- Service
- DTO
- Entity
- Module

This structure makes the codebase more modular and easier to extend.

---

## Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS ||--o{ WORKSPACE_MEMBERS : "joins"
    USERS ||--o{ PROJECT_MEMBERS : "assigned"
    USERS ||--o{ TASK_ASSIGNEES : "assigned"
    USERS ||--o{ DEPLOYMENTS : "deploys"
    USERS ||--o{ AUDIT_LOGS : "generates"
    USERS ||--o{ TASK_STATUS_HISTORY : "changes status"
    USERS ||--o{ WORKSPACES : "owns"
    USERS ||--o{ PROJECTS : "creates"

    WORKSPACES ||--o{ WORKSPACE_MEMBERS : "has members"
    WORKSPACES ||--o{ PROJECTS : "contains"
    WORKSPACES ||--o{ AUDIT_LOGS : "logs"

    PROJECTS ||--o{ PROJECT_MEMBERS : "has members"
    PROJECTS ||--o{ TASKS : "contains"
    PROJECTS ||--o{ DEPLOYMENTS : "has deployments"

    TASKS ||--o{ TASK_ASSIGNEES : "has assignees"
    TASKS ||--o{ TASK_STATUS_HISTORY : "tracks status"
    TASKS ||--o{ DEPLOYMENT_TASKS : "included in"

    DEPLOYMENTS ||--o{ DEPLOYMENT_TASKS : "contains tasks"

    USERS {
        uuid id PK
        varchar name
        varchar email UK
        varchar password
        enum role "SUPER_ADMIN,USER"
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    WORKSPACES {
        uuid id PK
        varchar name
        varchar slug UK
        uuid owner_id FK
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    WORKSPACE_MEMBERS {
        uuid workspace_id PK
        uuid user_id PK
        enum role "OWNER,ADMIN,ENGINEER,VIEWER"
        timestamp created_at
    }

    PROJECTS {
        uuid id PK
        uuid workspace_id FK
        uuid created_by FK
        varchar name
        text description
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    PROJECT_MEMBERS {
        uuid project_id PK
        uuid user_id PK
        enum role "ADMIN,ENGINEER,VIEWER"
        timestamp created_at
    }

    TASKS {
        uuid id PK
        uuid project_id FK
        varchar title
        text description
        enum status "TODO,IN_PROGRESS,DONE"
        enum priority "LOW,MEDIUM,HIGH"
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    TASK_ASSIGNEES {
        uuid task_id PK
        uuid user_id PK
        timestamp assigned_at
    }

    TASK_STATUS_HISTORY {
        uuid id PK
        uuid task_id FK
        uuid changed_by FK
        enum from_status
        enum to_status
        timestamp changed_at
    }

    DEPLOYMENTS {
        uuid id PK
        uuid project_id FK
        uuid deployed_by FK
        varchar version
        enum status "PENDING,RUNNING,SUCCESS,FAILED,ROLLBACK"
        timestamp deployed_at
        timestamp created_at
    }

    DEPLOYMENT_TASKS {
        uuid deployment_id PK
        uuid task_id PK
    }

    AUDIT_LOGS {
        uuid id PK
        uuid workspace_id FK
        uuid user_id FK
        enum action "CREATE,UPDATE,DELETE"
        varchar entity
        uuid entity_id
        json old_value
        json new_value
        varchar ip_address
        text user_agent
        timestamp created_at
    }
```

---

## Entity Explanation

### User

Represents a system user.

Responsibilities:

* Authenticate using JWT
* Create and manage projects
* Be assigned to tasks
* Execute deployments
* Participate in workspaces
---

### Workspace

Represents an isolated working environment for a team or organization.

Responsibilities:

* Organize projects
* Manage members
* Control access boundaries

Relationship:

```text
One Workspace → Many Projects
One Workspace → Many Members
```

---

### Workspace Member

Represents membership of a user inside a workspace.

Available Roles:

```text
ADMIN
MEMBER
```

Responsibilities:

* Control permissions inside a workspace
* Define ownership and collaboration
---

### Project

Represents a collection of tasks managed by a team.

Responsibilities:

* Store project information
* Group related tasks
* Organize deployment activities

Relationship:

```text
One Project → Many Tasks
```

---

### Task

Represents work items within a project.

Responsibilities:

* Track engineering work
* Assign ownership
* Monitor progress

Status:

```text
TODO
IN_PROGRESS
DONE
```

Priority:

```text
LOW
MEDIUM
HIGH
```

Relationship:

```text
One Task → Many Deployments
```

---

### Deployment

Represents deployment activities performed on a task.

Responsibilities:

* Track deployment history
* Record deployment status
* Trigger notifications

Status:

```text
PENDING
RUNNING
SUCCESS
FAILED
```

---

### Audit Log

Stores system activity records.

Responsibilities:

* Record create events
* Record update events
* Record delete events
* Provide traceability and accountability

Example:

```json
{
  "action": "UPDATE",
  "entity": "TASK",
  "entityId": "uuid",
  "oldValue": {},
  "newValue": {}
}

```

---

## Component Diagram

![Component Diagram](component-diagram.png)

### Component Explanation

#### Auth Module

Responsible for:

* Login
* JWT token generation
* Role validation
* Route protection

#### Workspace Module

Responsible for:

* Workspace management
* Membership management
* Access isolation

#### Project Manager

Responsible for:

* Project CRUD operations
* Project ownership validation

#### Task Manager

Responsible for:

* Task CRUD operations
* Task assignment
* Task status management

#### Deployment Manager

Responsible for:

* Deployment lifecycle management
* Deployment history tracking
* Deployment status updates

#### Audit Service

Responsible for:

* Capturing data changes
* Persisting audit records
* Supporting compliance and traceability

#### Notification Service

Responsible for:

* Sending deployment notifications
* Telegram Bot integration

#### PostgreSQL Database

Responsible for:

- Storing user data
- Storing project data
- Storing task data
- Storing deployment history

#### Telegram Bot

External service used for deployment notifications.

Example notification:

```text
Deployment Success

Project : OpsFlow
Task    : Release v1.0.0
Status  : SUCCESS
```

---

## API Documentation

Swagger UI is available after application startup:

```bash
http://localhost:3000/api
```

---

## Installation

Install dependencies:

```bash
npm install
```

---

## Environment Variables

Create `.env` file:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/opsflow

JWT_SECRET=your-secret-key

TELEGRAM_BOT_TOKEN=your-bot-token

TELEGRAM_CHAT_ID=your-chat-id

REDIS_HOST=localhost

REDIS_PORT=6379
```

---

## Running the Application

Development mode:

```bash
npm run start:dev
```

Production mode:

```bash
npm run build
npm run start:prod
```

---

## Running Tests

Unit test:

```bash
npm run test
```

E2E test:

```bash
npm run test:e2e
```

Coverage:

```bash
npm run test:cov
```

---

## Future Improvements

- Docker Compose Support
- BullMQ Queue Processing
- Deployment Rollback System
- Webhook Integration
- Internal Metrics Endpoint
- GitHub Actions CI Pipeline
- Multi Notification Provider (Slack/Email)
- Cloud Provider Integration (AWS/GCP)

---

## Author

Created as a Backend Engineer Technical Assessment using NestJS, PostgreSQL, JWT Authentication, Swagger, and Telegram Bot Integration.