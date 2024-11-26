# express-raw 🚀

![npm version](https://img.shields.io/npm/v/express-raw)
![downloads](https://img.shields.io/npm/dm/express-raw)
![GitHub stars](https://img.shields.io/github/stars/ddosnotification/express-raw)

A comprehensive Express.js utility package for request analytics, user behavior tracking, rate limiting, and beautiful console logging. Zero dependencies!

## Table of Contents
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Rate Limiting](#rate-limiting)
- [Logging](#logging)
- [DevTools Detection](#devtools-detection)
- [Mouse Tracking](#mouse-tracking)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Features

- 🔍 **Request Information** - Detailed insights about incoming requests with headers, body, and query analysis
- 👁️ **DevTools Detection** - Real-time detection of browser developer tools
- 🖱️ **Mouse Movement Analysis** - Advanced bot detection through movement patterns
- 🚦 **Rate Limiting** - Flexible request rate limiting with auto-ban capabilities
- 📊 **Enhanced Logging** - Beautiful, colorful console output with detailed metrics
- ⚡ **Zero Dependencies** - No external packages required
- 🎨 **Colorful Output** - Clear, organized console logs with visual hierarchy
- 🔒 **Security Features** - IP blocking, rate limiting, and bot detection

## Installation

```bash
npm install express-raw
```

## Quick Start

```javascript
const express = require('express');
const { expressLogger, RateLimiter } = require('express-raw');

const app = express();

// Initialize logger and rate limiter
const logger = new expressLogger();
const limiter = new RateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 100
});

// Apply middleware
app.use(limiter.middleware(logger));
app.use(logger.middleware());

// Start server
app.listen(3000, () => {
    logger.serverStart(3000);
});
```

## Rate Limiting

### Basic Configuration
```javascript
const limiter = new RateLimiter({
    // Time window settings
    windowMs: 15 * 60 * 1000,       // 15 minutes
    maxRequests: 100,               // Max requests per window
    windowType: 'sliding',          // 'sliding' or 'fixed'
    
    // Route-specific limits
    routeLimits: {
        '/api/auth/.*': 20,         // 20 requests for auth routes
        '/api/upload/.*': 10        // 10 requests for uploads
    },
    
    // Method-specific limits
    methodLimits: {
        'POST': 50,                 // 50 POST requests
        'PUT': 30                   // 30 PUT requests
    },
    
    // Auto-ban configuration
    autoBan: {
        enabled: true,
        maxViolations: 3,           // Ban after 3 violations
        banDurationMs: 24 * 60 * 60 * 1000  // 24 hour ban
    },
    
    // Whitelist & Blacklist
    whitelist: ['127.0.0.1'],       // IPs to skip
    blacklist: ['10.0.0.1'],        // IPs to block
    
    // Response customization
    statusCode: 429,
    message: 'Too many requests'
});
```

## Logging

### Logger Configuration
```javascript
const logger = new expressLogger({
    enabled: {
        server: true,               // Server start/stop logs
        requests: true,             // Incoming requests
        responses: true,            // Outgoing responses
        errors: true,               // Error tracking
        heartbeat: true,            // System status
        performance: true,          // Performance metrics
        rateLimit: true             // Rate limit events
    },
    heartbeatInterval: 10000,       // Status update every 10s
    colors: true                    // Colored output
});
```

### Log Output Examples

Server Start:
```
[2024-11-25T19:38:20.177Z] ⚡ [SERVER] Server started
    Port: 3000
    Environment: development
    NodeVersion: v22.11.0
    Memory: 8MB
    StartupDuration: 234ms
```

Request Log:
```
[2024-11-25T19:38:25.123Z] ○ [INFO] GET /api/users
    IP: 192.168.1.100
    UserAgent: Mozilla/5.0
    RequestId: 1
    ActiveConnections: 1
```

Rate Limit Event:
```
[2024-11-25T19:38:26.177Z] ⚠️ [RATELIMIT] Rate limit exceeded
    IP: 192.168.1.100
    Path: /api/users
    Method: POST
    Limit: 100
    CurrentRequests: 101
    ViolationCount: 1
```

## DevTools Detection

```javascript
const detector = detectDevTools();

// Get detection script
app.get('/', (req, res) => {
    res.send(`
        <script>${detector.getScript()}</script>
        <script>
            setInterval(() => {
                console.log('DevTools:', window.devToolsOpen);
            }, 1000);
        </script>
    `);
});
```

## Mouse Tracking

```javascript
const tracker = mouseTracker({
    trackingTime: 5000  // Track for 5 seconds
});

app.get('/', (req, res) => {
    res.send(`
        <script>${tracker.getScript()}</script>
        <script>
            setTimeout(() => {
                console.log('Movement Analysis:', window.movementAnalysis);
            }, 5000);
        </script>
    `);
});
```

### Mouse Analysis Output
```json
{
    "isBot": false,
    "confidence": 0.92,
    "metrics": {
        "speedVariance": 0.245,
        "angleVariance": 0.089,
        "straightLines": 12,
        "naturalCurves": 8,
        "suddenStops": 1
    }
}
```

## Complete Example

```javascript
const express = require('express');
const { 
    expressLogger, 
    RateLimiter, 
    detectDevTools, 
    mouseTracker 
} = require('express-raw');

const app = express();

// Initialize components
const logger = new expressLogger({
    enabled: { rateLimit: true, requests: true }
});

const limiter = new RateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
    autoBan: { enabled: true, maxViolations: 3 }
});

const detector = detectDevTools();
const tracker = mouseTracker({ trackingTime: 5000 });

// Apply middleware
app.use(express.json());
app.use(limiter.middleware(logger));
app.use(logger.middleware());

// Routes
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
            <head><title>Analytics Demo</title></head>
            <body>
                <h1>User Behavior Analytics</h1>
                <div id="results"></div>
                <script>${detector.getScript()}</script>
                <script>${tracker.getScript()}</script>
                <script>
                    setInterval(() => {
                        const results = {
                            devTools: window.devToolsOpen,
                            movement: window.movementAnalysis
                        };
                        document.getElementById('results').textContent = 
                            JSON.stringify(results, null, 2);
                    }, 1000);
                </script>
            </body>
        </html>
    `);
});

// Error handling
app.use((err, req, res, next) => {
    logger.error(err, req);
    res.status(500).send('Server Error');
});

// Start server
app.listen(3000, () => {
    logger.serverStart(3000);
});
```

## Best Practices

### Rate Limiting
- Use sliding windows for more accurate rate limiting
- Set appropriate limits based on route sensitivity
- Enable auto-ban for persistent violators
- Whitelist internal IPs and monitoring services

### Logging
- Disable colors in production environments
- Adjust heartbeat interval based on server load
- Don't log sensitive information
- Use appropriate log levels

### Performance
- Set reasonable tracking durations for mouse movement
- Clean up event listeners when not needed
- Use appropriate rate limit windows
- Monitor memory usage with heartbeat

## Troubleshooting

### Rate Limiter Issues
```javascript
// Fix: Too many false positives
const limiter = new RateLimiter({
    windowType: 'sliding',
    maxRequests: 200
});

// Fix: Auto-ban too aggressive
const limiter = new RateLimiter({
    autoBan: {
        maxViolations: 5,
        banDurationMs: 60 * 60 * 1000  // 1 hour
    }
});
```

### Logger Issues
```javascript
// Fix: Colors not showing
const logger = new expressLogger({
    colors: true,
    enabled: { requests: true }
});

// Fix: Too many logs
const logger = new expressLogger({
    enabled: {
        heartbeat: false,
        requests: true,
        responses: false
    }
});
```

## Support

For issues and feature requests, please use the GitHub issue tracker.

---
Made with ♥ by ZeX