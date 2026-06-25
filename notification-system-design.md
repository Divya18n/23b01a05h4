# Notification System Design

## Stage 1

I started by thinking about what a student actually needs from this system. They need to see their notifications, filter them by type, mark them as read, and get updates without refreshing. Based on this I came up with three core API endpoints.

### REST API Endpoints

**GET /api/notifications** — Students use this to load their notifications. I added page, limit and notification_type as query params so we don't load everything at once and the frontend can filter by Placement, Result or Event.

GET /api/notifications?page=1&limit=10&notification_type=Placement
Authorization: Bearer <token>

Response:
{
  "notifications": [
    {
      "ID": "d146095a-0d86-4a34-9e69-3900a14576bc",
      "Type": "Placement",
      "Message": "Google is hiring for SDE roles",
      "Timestamp": "2026-04-22 17:51:30"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 10
}

**PATCH /api/notifications/:id/read** — Called when a student taps a notification to mark it as read.

PATCH /api/notifications/d146095a-0d86-4a34-9e69-3900a14576bc/read
Authorization: Bearer <token>

Response:
{ "success": true, "message": "Notification marked as read" }

**POST /api/notifications** — Admin only. Used to create and push a new notification to a student.

Request body:
{
  "type": "Placement",
  "message": "Google is hiring for SDE roles",
  "studentId": "fa169495-39d5-452a-a9d4-1edd08e02f93"
}

Response:
{
  "id": "uuid",
  "type": "Placement",
  "message": "Google is hiring for SDE roles",
  "timestamp": "2026-06-25 10:00:00"
}

### Real-time Mechanism

I chose WebSockets instead of polling. With polling the frontend keeps asking the server every few seconds which wastes resources. With WebSockets the server pushes the notification to the student the moment it is created.

// server side - push to the right student
wss.clients.forEach((client) => {
  if (client.studentId === notification.studentId) {
    client.send(JSON.stringify(notification));
  }
});

// frontend - receive and update UI instantly
const ws = new WebSocket("ws://localhost:8080");
ws.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  setNotifications((prev) => [notification, ...prev]);
};

---

## Stage 2

### Database Choice: PostgreSQL

I went with PostgreSQL because notifications and students have a clear relationship and a relational database models that naturally. The other reason is ACID compliance — I did not want a situation where a notification gets partially saved or lost silently when the server is under load.

### Schema

CREATE TYPE notification_type AS ENUM ('Placement', 'Result', 'Event');

CREATE TABLE students (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  studentId UUID REFERENCES students(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  message TEXT NOT NULL,
  isRead BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT NOW()
);

### Problems at Scale

Once the notifications table has millions of rows, even indexed queries slow down because the table itself is too large. My solution is to partition the table by month so each query only touches the current partition instead of the full table.

CREATE TABLE notifications_2026_06
PARTITION OF notifications
FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

Notifications older than 6 months get archived to cold storage and removed from the live table so the hot table stays small and fast.

---

## Stage 3

### Query Analysis

The query is logically correct — it fetches the right rows. But it is slow because there are no indexes on studentId, isRead or createdAt. With 5 million rows the database has to scan every single row one by one on every request. That is a full table scan and it is very expensive.

### Fix

CREATE INDEX idx_notifications_student_read_date
ON notifications(studentId, isRead, createdAt DESC);

SELECT id, type, message, createdAt
FROM notifications
WHERE studentId = 1042 AND isRead = false
ORDER BY createdAt ASC;

I also replaced SELECT * with only the columns the frontend actually needs. Less data coming out of the database means faster response times. After adding the composite index the cost drops from O(n) full scan to O(log n) index lookup which is dramatically faster at scale.

### Adding Indexes on Every Column is Bad

Every index you add slows down INSERT and UPDATE because the database has to update all indexes on every write. When we are sending notifications to 50,000 students there are thousands of inserts happening at once. Adding unnecessary indexes would make those writes very slow. We should only index columns that appear in WHERE, ORDER BY or JOIN clauses.

### Placement Notifications in Last 7 Days

SELECT DISTINCT studentId
FROM notifications
WHERE type = 'Placement'
AND createdAt >= NOW() - INTERVAL '7 days';

---

## Stage 4

### Caching with Redis

When 50,000 students open the app at the same time during placement season, hitting the database on every single request will bring it down. I introduced a Redis cache layer to fix this.

async function getNotifications(studentId, page, limit) {
  const cacheKey = `notifications:${studentId}:${page}:${limit}`;

  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const data = await db.query(
    `SELECT id, type, message, createdAt
     FROM notifications
     WHERE studentId = $1
     ORDER BY createdAt DESC
     LIMIT $2 OFFSET $3`,
    [studentId, limit, (page - 1) * limit]
  );

  await redis.setex(cacheKey, 60, JSON.stringify(data));
  return data;
}

async function invalidateCache(studentId) {
  const keys = await redis.keys(`notifications:${studentId}:*`);
  if (keys.length > 0) await redis.del(keys);
}

### Tradeoffs

- Cache hit: response is instant, database is not touched at all
- Cache miss: still hits the database but warms the cache for all requests after that
- Stale data: student might see data that is up to 60 seconds old which is acceptable for a notification system
- No cache at all: database crashes exactly when it matters most during active placement drives

---

## Stage 5

### Problems with Original Implementation

The original code loops through all 50,000 students one by one, calling the email API and doing a DB insert for each student synchronously. This is very slow. If the email API fails at student 20,000 there is no retry and the remaining 30,000 get nothing. Also DB and email are tightly coupled so if email is slow the DB insert also waits.

### Redesigned with Message Queue

async function notify_all(student_ids, message) {
  const batches = chunk(student_ids, 100);
  for (const batch of batches) {
    await queue.push({ type: "notify_batch", batch, message });
  }
}

async function process_batch(batch, message) {
  for (const student_id of batch) {
    await save_to_db(student_id, message);
    await queue.push({ type: "send_email", student_id, message });
    await queue.push({ type: "push_to_app", student_id, message });
  }
}

async function send_email_worker(job) {
  try {
    await send_email(job.student_id, job.message);
  } catch (error) {
    if (job.attempts < 3) {
      await queue.retry(job, { delay: 300000 });
    } else {
      await Log("backend", "fatal", "service",
        `Email permanently failed for student: ${job.student_id}`);
    }
  }
}

### DB and Email Together?

No. The DB save should always happen first and independently. The database is the source of truth. Once a notification is saved there it exists and shows up in the app even if the email fails. Email is just a delivery side effect. By decoupling them through a queue we can retry failed emails without affecting anything else.

---

## Stage 6

### Priority Algorithm

I built a scoring function that ranks each notification based on its type and how recent it is. Type is the dominant factor because a Placement notification is always more important than an Event regardless of timing.

Score = (type_weight x 10) + (recency_score x 5)

Type weights: Placement = 3, Result = 2, Event = 1

Recency decays by hour:
recency = 1 / (1 + age_in_hours)

const TYPE_WEIGHT = { Placement: 3, Result: 2, Event: 1 };

function getPriorityScore(notification) {
  const weight = TYPE_WEIGHT[notification.Type] ?? 0;
  const ageInHours =
    (Date.now() - new Date(notification.Timestamp).getTime()) / 1000 / 3600;
  const recencyScore = 1 / (1 + ageInHours);
  return weight * 10 + recencyScore * 5;
}

function getTopN(notifications, n = 10) {
  return [...notifications]
    .sort((a, b) => getPriorityScore(b) - getPriorityScore(a))
    .slice(0, n);
}

### Maintaining Top N Efficiently

For a live stream of notifications I use a min-heap of size n. When a new notification arrives I compare its score with the lowest score currently in the heap. If the new one is higher I remove the minimum and push the new one in. This way I never sort the full list and each new notification is handled in O(log n) time.

class MinHeap {
  constructor() { this.heap = []; }

  push(item) {
    this.heap.push(item);
    this.heap.sort((a, b) => getPriorityScore(a) - getPriorityScore(b));
  }

  pop() { return this.heap.shift(); }
  peek() { return this.heap[0]; }
  size() { return this.heap.length; }
}

function maintainTopN(newNotification, heap, n) {
  if (heap.size() < n) {
    heap.push(newNotification);
  } else if (getPriorityScore(newNotification) > getPriorityScore(heap.peek())) {
    heap.pop();
    heap.push(newNotification);
  }
}