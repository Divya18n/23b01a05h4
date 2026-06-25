# Campus Notification System

A production-grade full stack notification platform enabling real-time delivery of campus updates across Placement, Result, and Event categories. Built with a React frontend, Express.js backend, and a reusable logging middleware integrated throughout the application stack.

---

## Project Structure

Campus-Evaluation-FS/
├── logging-middleware/            # Reusable Log() middleware package
├── notification-app-be/           # Node.js + Express REST API server
├── notification-app-fe/           # React + Material UI frontend application
├── screenshots/                   # Desktop and mobile output screenshots
└── notification-system-design.md  # System design documentation (Stages 1-6)

---

## Key Features

- Real-time notification feed with pagination and type-based filtering
- Priority Inbox with a custom scoring algorithm based on notification type weight and recency decay
- Dynamic top-N selector (5, 10, 15, 20 notifications)
- Visual distinction between new and already-viewed notifications
- Fully responsive UI optimized for both desktop and mobile viewports
- Structured logging middleware sending lifecycle logs to the evaluation server
- Robust error handling across all API calls and UI states

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, JavaScript, Material UI, Vite |
| Backend | Node.js, Express.js, REST APIs |
| Logging | Custom reusable Log() middleware |
| Styling | Material UI only |

---

## Getting Started

### Prerequisites
- Node.js v18+
- npm

### Run Backend
cd notification-app-be
npm install
node index.js

Server starts at http://localhost:8080

### Run Frontend
cd notification-app-fe
npm install
npm run dev

Application runs at http://localhost:3000

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /notifications | Fetch paginated notifications with optional type filter |
| PATCH | /notifications/:id/read | Mark a notification as read |
| GET | /health | Server health check |

---

## Priority Algorithm

Notifications in the Priority Inbox are ranked using a composite score:

Score = (type_weight x 10) + (recency_score x 5)

| Type | Weight |
|------|--------|
| Placement | 3 |
| Result | 2 |
| Event | 1 |

Recency decays by hour: 1 / (1 + age_in_hours)

Top-N is maintained efficiently using a min-heap with O(log n) insertion time.

---

## Logging Middleware

A reusable Log(stack, level, package, message) function is integrated throughout both frontend and backend codebases. All significant application events including API calls, page loads, errors, and state changes are captured and sent to the evaluation server.

---

## System Design

Comprehensive system design documentation covering all 6 stages is available in notification-system-design.md:

- Stage 1 — REST API design and real-time mechanism
- Stage 2 — Database schema and scaling strategy
- Stage 3 — Query optimization and indexing
- Stage 4 — Caching with Redis
- Stage 5 — Bulk notification handling with message queues
- Stage 6 — Priority Inbox algorithm and implementation

---

## Output Screenshots

All screenshots including desktop and mobile views are available in the /screenshots directory.
