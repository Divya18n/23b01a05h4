import { useState, useEffect, useCallback } from "react";
import { fetchNotifications } from "../api/notifications";
import { Log } from "../middleware/logger";

export function useNotifications(filter = "All", page = 1, limit = 10) {
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    Log("frontend", "info", "hook", `Loading notifications: filter=${filter}, page=${page}`);
    try {
      const data = await fetchNotifications({ page, limit, notification_type: filter });
      setNotifications(data.notifications ?? []);
      setTotal(data.total ?? data.notifications?.length ?? 0);
      Log("frontend", "info", "hook", `Notifications loaded successfully`);
    } catch (err) {
      setError(err.message);
      Log("frontend", "error", "hook", `Failed to load notifications: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [filter, page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.ceil(total / limit) || 1;

  return { notifications, total, totalPages, loading, error, reload: load };
}