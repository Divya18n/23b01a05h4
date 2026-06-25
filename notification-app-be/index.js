import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const BASE_URL = "http://4.224.186.213/evaluation-service";
const PORT = 8080;

// Logging middleware
const Log = async (stack, level, pkg, message, token) => {
  try {
    await fetch(`${BASE_URL}/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ stack, level, package: pkg, message }),
    });
  } catch (_) {}
};

// GET /notifications
app.get("/notifications", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  const { page = 1, limit = 10, notification_type = "" } = req.query;

  await Log("backend", "info", "handler", `GET /notifications called page=${page} type=${notification_type}`, token);

  try {
    const params = new URLSearchParams({ page, limit });
    if (notification_type && notification_type !== "All") {
      params.append("notification_type", notification_type);
    }

    const response = await fetch(`${BASE_URL}/notifications?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      await Log("backend", "error", "handler", `Upstream failed: ${response.status}`, token);
      return res.status(response.status).json({ error: "Upstream error" });
    }

    const data = await response.json();
    await Log("backend", "info", "handler", `Returned ${data.notifications?.length ?? 0} notifications`, token);
    return res.json(data);
  } catch (err) {
    await Log("backend", "fatal", "handler", `Exception: ${err.message}`, token);
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /notifications/:id/read
app.patch("/notifications/:id/read", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  const { id } = req.params;
  await Log("backend", "info", "handler", `PATCH /notifications/${id}/read called`, token);

  try {
    const response = await fetch(`${BASE_URL}/notifications/${id}/read`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    await Log("backend", "info", "handler", `Notification ${id} marked as read`, token);
    return res.json(data);
  } catch (err) {
    await Log("backend", "fatal", "handler", `Exception: ${err.message}`, token);
    return res.status(500).json({ error: err.message });
  }
});
// Root route
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Notification Backend is running",
    version: "1.0.0",
    endpoints: [
      "GET /notifications",
      "PATCH /notifications/:id/read",
      "GET /health"
    ]
  });
});
// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Notification backend running" });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});