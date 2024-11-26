# express-raw 🚀

![npm version](https://img.shields.io/npm/v/express-raw)
![downloads](https://img.shields.io/npm/dm/express-raw)
![GitHub stars](https://img.shields.io/github/stars/ddosnotification/express-raw)

A comprehensive Express.js utility package for request analytics, user behavior tracking, rate limiting, and beautiful console logging. Zero dependencies!

## Features

- 🔍 **Request Information** - Detailed insights about incoming requests
- 👁️ **DevTools Detection** - Track when browser dev tools are opened
- 🖱️ **Mouse Movement Analysis** - Detect bot-like behavior
- 🚦 **Rate Limiting** - Advanced request rate limiting with auto-ban
- 📊 **Enhanced Logging** - Beautiful, colorful console output with detailed metrics

## Installation

```bash
npm install express-raw
```

## Quick Start

```javascript
const express = require('express');
const { expressLogger, RateLimiter } = require('express-raw');

const app = express();
const logger = new expressLogger();
const limiter = new RateLimiter({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 100
});

app.use(limiter.middleware(logger));
app.use(logger.middleware());

app.listen(3000, () => {
    logger.serverStart(3000);
});
```

## Features Overview

### Rate Limiting
```javascript
const limiter = new RateLimiter({
    // Basic configuration
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 100,          // Max requests per window
    windowType: 'sliding',     // 'sliding' or 'fixed'

    // Route-specific limits
    routeLimits: {
        '/api/auth/.*': 20,    // 20 requests per window for auth routes
        '/api/upload/.*': 10   // 10 requests per window for uploads
    },

    // Auto-ban configuration
    autoBan: {
        enabled: true,
        maxViolations: 3,
        banDurationMs: 24 * 60 * 60 * 1000  // 24 hours
    }
});
```

[Previous sections remain the same until API Reference]

## API Reference

### Rate Limiter Options
```javascript
{
    // Basic rate limiting
    windowMs: 60 * 1000,           // Window size in ms
    maxRequests: 100,              // Max requests per window
    windowType: 'sliding',         // 'sliding' or 'fixed'
    
    // Route specific
    routeLimits: {},               // Route-specific limits
    methodLimits: {},              // Method-specific limits
    
    // Security
    whitelist: [],                 // IPs to skip
    blacklist: [],                 // IPs to always block
    
    // Auto ban
    autoBan: {
        enabled: false,
        maxViolations: 5,
        banDurationMs: 24 * 60 * 60 * 1000
    }
}
```

[Previous logging outputs section]

Add new example output:
```
[2024-11-25T19:38:26.177Z] ⚠️ [RATELIMIT] Rate limit exceeded for 192.168.1.1
    IP: 192.168.1.1
    Path: /api/test
    Method: POST
    Limit: 100
    CurrentRequests: 101
    ViolationCount: 1

[2024-11-25T19:38:27.234Z] 🚫 [BANNED] IP banned: 192.168.1.1
    IP: 192.168.1.1
    Duration: 86400000ms
    Violations: 3
    ExpiresAt: 2024-11-26T19:38:27.234Z
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

// Initialize logger and rate limiter
const logger = new expressLogger({
    enabled: {
        rateLimit: true,
        requests: true,
        responses: true
    }
});

const limiter = new RateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
    routeLimits: {
        '/api/auth/.*': 20,
        '/api/upload/.*': 10
    },
    autoBan: {
        enabled: true,
        maxViolations: 3
    }
});

// Middleware
app.use(express.json());
app.use(limiter.middleware(logger));
app.use(logger.middleware());

// Routes
app.get('/info', (req, res) => {
    res.json(getRequestInfo(req));
});

app.listen(3000, () => {
    logger.serverStart(3000);
});
```

[Previous sections remain the same until Upcoming Features]

## Upcoming Features

- [ ] Custom Log Formats
- [ ] Log File Output
- [ ] Metrics Dashboard
- [ ] Performance Profiling
- [ ] WebSocket Support
- [ ] Rate Limit Storage Adapters
- [ ] GraphQL Integration

[Rest remains the same]

## Support

For issues and feature requests, please use the GitHub issue tracker.

---
Made with ♥ by ZeX