const BASE_URL = "/api";

export const Log = async (stack, level, pkg, message) => {
  const token = localStorage.getItem("authToken");
  if (!token) return;
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