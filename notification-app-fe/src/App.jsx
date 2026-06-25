import { useState, useEffect } from "react";
import { Box, Tab, Tabs, TextField, Button, Typography, Paper } from "@mui/material";
import { NotificationsPage } from "./pages/NotificationsPage";
import { PriorityPage } from "./pages/PriorityPage";
import { Log } from "./middleware/logger";

export default function App() {
  const [tab, setTab] = useState(0);
  const [token, setToken] = useState(localStorage.getItem("authToken") || "");
  const [inputToken, setInputToken] = useState("");

  useEffect(() => {
    if (token) Log("frontend", "info", "config", "App initialized with auth token");
  }, [token]);

  const handleSaveToken = () => {
    localStorage.setItem("authToken", inputToken);
    setToken(inputToken);
    Log("frontend", "info", "auth", "Auth token saved");
  };

  if (!token) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" bgcolor="#f5f5f5">
        <Paper sx={{ p: 4, maxWidth: 400, width: "100%" }}>
          <Typography variant="h6" mb={2}>Enter Your Auth Token</Typography>
          <TextField fullWidth multiline rows={4} label="Bearer Token"
            value={inputToken} onChange={(e) => setInputToken(e.target.value)} sx={{ mb: 2 }} />
          <Button fullWidth variant="contained" onClick={handleSaveToken}>Save & Continue</Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "#fff", position: "sticky", top: 0, zIndex: 10 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} centered>
          <Tab label="All Notifications" />
          <Tab label="Priority Inbox" />
        </Tabs>
      </Box>
      {tab === 0 && <NotificationsPage />}
      {tab === 1 && <PriorityPage />}
    </Box>
  );
}