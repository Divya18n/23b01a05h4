const BASE_URL = "http://4.224.186.213/evaluation-service";

let authToken = "";

export const setAuthToken = (token) => {
  authToken = token;
};

export const Log = async (stack, level, pkg, message) => {
  if (!authToken) return;
  try {
    await fetch(`${BASE_URL}/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ stack, level, package: pkg, message }),
    });
  } catch (_) {}
};