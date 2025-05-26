const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.text({ limit: "10mb" }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")));

// Main route to serve the frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// API proxy endpoint
app.all("/api/proxy", async (req, res) => {
  try {
    const { url, method = "GET", headers = {}, body, params = {} } = req.body;

    if (!url) {
      return res.status(400).json({
        error: "URL is required",
        success: false,
      });
    }

    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({
        error: "Invalid URL format",
        success: false,
      });
    }

    // Prepare axios config
    const axiosConfig = {
      method: method.toLowerCase(),
      url: url,
      headers: {
        ...headers,
        // Remove host header to avoid conflicts
        host: undefined,
      },
      params: params,
      timeout: 30000, // 30 seconds timeout
      maxRedirects: 5,
      validateStatus: () => true, // Accept all status codes
    };

    // Add body for methods that support it
    if (["post", "put", "patch"].includes(method.toLowerCase()) && body) {
      axiosConfig.data = body;
    }

    // Remove undefined headers
    Object.keys(axiosConfig.headers).forEach((key) => {
      if (axiosConfig.headers[key] === undefined) {
        delete axiosConfig.headers[key];
      }
    });

    const startTime = Date.now();

    // Make the request
    const response = await axios(axiosConfig);

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Prepare response data
    const responseData = {
      success: true,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
      responseTime: responseTime,
      size: JSON.stringify(response.data).length,
    };

    res.json(responseData);
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - Date.now();

    console.error("Proxy request error:", error.message);

    // Handle axios errors
    if (error.response) {
      // Server responded with error status
      res.json({
        success: true,
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        data: error.response.data,
        responseTime: responseTime,
        size: JSON.stringify(error.response.data || "").length,
      });
    } else if (error.request) {
      // Request was made but no response received
      res.status(500).json({
        success: false,
        error: "Network error: No response received",
        details: error.message,
        responseTime: responseTime,
      });
    } else {
      // Something else happened
      res.status(500).json({
        success: false,
        error: "Request configuration error",
        details: error.message,
        responseTime: responseTime,
      });
    }
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Server error:", error);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: error.message,
  });
});

// Handle 404s
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Postman Clone Server is running on port ${PORT}`);
  console.log(`📱 Access the app at: http://localhost:${PORT}`);
  console.log(`🔗 API Proxy endpoint: http://localhost:${PORT}/api/proxy`);
  console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
