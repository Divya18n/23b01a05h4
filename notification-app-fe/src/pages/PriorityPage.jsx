import { useState, useEffect } from "react";
import {
  Alert, Box, CircularProgress, Divider, Slider,
  Stack, Typography, Chip, Paper,
} from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import { fetchNotifications } from "../api/notifications";
import { Log } from "../middleware/logger";

const TYPE_WEIGHT = { Placement: 3, Result: 2, Event: 1 };

function getPriorityScore(n) {
  const weight = TYPE_WEIGHT[n.Type] ?? 0;
  const age = Date.now() - new Date(n.Timestamp).getTime();
  const recency = 1 / (1 + age / 1000 / 3600);
  return weight * 10 + recency * 5;
}

const typeColors = { Placement: "success", Result: "warning", Event: "info" };

export function PriorityPage() {
  const [topN, setTopN] = useState(10);
  const [filter, setFilter] = useState("All");
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Log("frontend", "info", "page", "PriorityPage mounted");
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchNotifications({ page: 1, limit: 10 });
        setAll(data.notifications ?? []);
        Log("frontend", "info", "page", `Loaded ${data.notifications?.length} for priority`);
      } catch (err) {
        setError(err.message);
        Log("frontend", "error", "page", `PriorityPage load failed: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = filter === "All" ? all : all.filter((n) => n.Type === filter);
  const prioritized = [...filtered].sort((a, b) => getPriorityScore(b) - getPriorityScore(a)).slice(0, topN);

  return (
    <Box sx={{ maxWidth: 720, mx: "auto", px: 2, py: 4 }}>
      <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
        <StarIcon sx={{ fontSize: 28, color: "gold" }} />
        <Typography variant="h5" fontWeight={700}>Priority Inbox</Typography>
      </Stack>

      <Divider sx={{ mb: 3 }} />

      <Box mb={3}>
        <Typography gutterBottom>Show top {topN} notifications</Typography>
        <Slider
          value={topN}
          onChange={(_, val) => setTopN(val)}
          min={5} max={20} step={5}
          marks={[{value:5,label:"5"},{value:10,label:"10"},{value:15,label:"15"},{value:20,label:"20"}]}
          sx={{ maxWidth: 300 }}
        />
      </Box>

      <Stack direction="row" spacing={1} mb={3} flexWrap="wrap">
        {["All","Placement","Result","Event"].map((t) => (
          <Chip key={t} label={t} onClick={() => setFilter(t)}
            color={filter === t ? "primary" : "default"}
            variant={filter === t ? "filled" : "outlined"} />
        ))}
      </Stack>

      {loading && <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>}
      {!loading && error && <Alert severity="error">Failed to load: {error}</Alert>}
      {!loading && !error && prioritized.length === 0 && <Alert severity="info">No notifications found.</Alert>}

      {!loading && !error && prioritized.map((n, idx) => (
        <Paper key={n.ID} elevation={2} sx={{ p: 2, mb: 1.5, borderLeft: `4px solid ${idx < 3 ? "gold" : "#1976d2"}` }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography fontWeight={700}>#{idx + 1} {n.Message}</Typography>
            <Chip label={n.Type} color={typeColors[n.Type] ?? "default"} size="small" />
          </Box>
          <Typography variant="caption" color="text.secondary">
            {new Date(n.Timestamp).toLocaleString()} · Score: {getPriorityScore(n).toFixed(2)}
          </Typography>
        </Paper>
      ))}
    </Box>
  );
}