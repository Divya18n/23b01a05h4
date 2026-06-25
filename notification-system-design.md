# Notification System Design

## Stage 1
### REST API Endpoints

**GET /api/notifications** - Fetch all notifications
- Query params: page, limit, notification_type
- Headers: Authorization: Bearer <token>
- Response: { notifications: [], total: number }

**PATCH /api/notifications/:id/read** - Mark as read
- Headers: Authorization: Bearer <token>
- Response: { success: true }

**POST /api/notifications** - Create notification (admin)
- Body: { type, message, studentId }
- Response: { id, type, message, timestamp }

### Real-time Mechanism
Use WebSockets. Server pushes new notifications to connected clients instantly without polling.

## Stage 2
### Database Choice: PostgreSQL
Relational data with clear relationships between students and notifications. ACID compliance ensures no notification is lost.

### Schema
CREATE TABLE students (
  id UUID PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100) UNIQUE
);

CREATE TYPE notification_type AS ENUM ('Placement', 'Result', 'Event');

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  studentId UUID REFERENCES students(id),
  type notification_type,
  message TEXT,
  isRead BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT NOW()
);

### Problems at scale
- Table grows too large, queries slow down
- Solution: Partition table by createdAt, archive old data

## Stage 3
### Query Analysis
The query is accurate but slow - no indexes exist on studentId, isRead, createdAt causing full table scan on 5 million rows.

### Fix
CREATE INDEX idx_notifications_student_read_date
ON notifications(studentId, isRead, createdAt DESC);

SELECT id, type, message, createdAt
FROM notifications
WHERE studentId = 1042 AND isRead = false
ORDER BY createdAt ASC;

Selecting specific columns instead of * reduces data transfer. Cost drops from O(n) full scan to O(log n) index lookup.

### Adding indexes on every column is bad
Each index slows INSERT/UPDATE and wastes storage. Only index columns used in WHERE, ORDER BY, JOIN.

### Placement notifications last 7 days
SELECT DISTINCT studentId
FROM notifications
WHERE notificationType = 'Placement'
AND createdAt >= NOW() - INTERVAL '7 days';

## Stage 4
### Caching with Redis
- First fetch: query DB, store in Redis with TTL 60 seconds
- Subsequent fetches: return from cache
- New notification arrives: invalidate student cache

### Tradeoffs
- Cache hit: very fast, low DB load
- Cache miss: hits DB but warms cache
- Stale data: student may see outdated data for up to 60 seconds

## Stage 5
### Problems with original implementation
- Sequential loop over 50000 students is very slow
- No retry if send_email fails midway
- DB and email tightly coupled

### Redesigned
async function notify_all(student_ids, message):
  batches = chunk(student_ids, 100)
  for batch in batches:
    queue.push({ type: "notify_batch", batch, message })

async function process_batch(batch, message):
  for student_id in batch:
    await Promise.allSettled([
      queue.push({ type: "send_email", student_id, message }),
      save_to_db(student_id, message),
      push_to_app(student_id, message)
    ])

async function send_email_worker(job):
  try:
    send_email(job.student_id, job.message)
  catch:
    queue.retry(job, max_retries=3)

### DB and Email together?
No. Save to DB first always. Email is a side effect and can be retried. DB is source of truth.

## Stage 6
### Priority Algorithm
Score = (type_weight x 10) + (recency_score x 5)
- Placement = 3, Result = 2, Event = 1
- Recency = 1 / (1 + age_in_hours)

Use a max-heap of size n. For new notifications compare with minimum in heap, replace if higher score. Maintains top-n in O(log n) time.