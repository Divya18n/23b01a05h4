import { Log } from "../middleware/logger";

const BASE_URL = "/api";

export async function fetchNotifications({ page = 1, limit = 10, notification_type = "" } = {}) {
  const token = localStorage.getItem("authToken");

  const params = new URLSearchParams({ page, limit });
  if (notification_type && notification_type !== "All") {
    params.append("notification_type", notification_type);
  }

  Log("frontend", "info", "api", `Fetching notifications: page=${page}, type=${notification_type}`);

  try {
    const res = await fetch(`${BASE_URL}/notifications?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      Log("frontend", "error", "api", `Notifications fetch failed: status ${res.status}`);
      throw new Error(`HTTP error: ${res.status}`);
    }

    const data = await res.json();
    Log("frontend", "info", "api", `Fetched ${data.notifications?.length ?? 0} notifications`);
    return data;
  } catch (err) {
    Log("frontend", "fatal", "api", `Notifications fetch exception: ${err.message}`);
    throw err;
  }
}