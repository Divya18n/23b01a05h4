import { Box, Chip, Paper, Typography } from "@mui/material";
import { Log } from "../middleware/logger";

const typeColors = { Placement: "success", Result: "warning", Event: "info" };

export function NotificationCard({ notification, isNew }) {
  const handleClick = () => {
    Log("frontend", "info", "component", `Notification viewed: ${notification.ID}`);
  };

  return (
    <Paper
      onClick={handleClick}
      elevation={isNew ? 3 : 1}
      sx={{
        p: 2,
        borderLeft: isNew ? "4px solid #1976d2" : "4px solid transparent",
        backgroundColor: isNew ? "#f0f7ff" : "#fff",
        cursor: "pointer",
        "&:hover": { backgroundColor: "#e8f4fd" },
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="body1" fontWeight={isNew ? 700 : 400}>
          {notification.Message}
        </Typography>
        <Chip label={notification.Type} color={typeColors[notification.Type] ?? "default"} size="small" />
      </Box>
      <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
        {new Date(notification.Timestamp).toLocaleString()}
        {isNew && <Chip label="New" size="small" color="primary" sx={{ ml: 1, height: 16, fontSize: 10 }} />}
      </Typography>
    </Paper>
  );
}