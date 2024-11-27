<div align="center">

# express-raw

### Advanced Express.js Utilities for Modern Applications

[![npm version](https://img.shields.io/npm/v/express-raw?style=for-the-badge&logo=npm&color=cb3837)](https://www.npmjs.com/package/express-raw)
[![downloads](https://img.shields.io/npm/dm/express-raw?style=for-the-badge&logo=npm&color=252525)](https://www.npmjs.com/package/express-raw)
[![GitHub stars](https://img.shields.io/github/stars/ddosnotification/express-raw?style=for-the-badge&logo=github&color=252525)](https://github.com/ddosnotification/express-raw)

*Zero-dependency toolkit for request analytics, performance monitoring, rate limiting, and real-time communication*

</div>

---

## ✨ Features

<table>
<tr>
<td>

### Core Features
- 🔍 **Request Analytics**
- 🚦 **Rate Limiting**
- 📊 **Enhanced Logging**
- 👁️ **DevTools Detection**

</td>
<td>

### Advanced Features
- 🔌 **WebSocket Support**
- 🎯 **GraphQL Integration**
- 📈 **Metrics Dashboard**
- 🔒 **Security Suite**

</td>
</tr>
</table>

## 📦 Installation

```bash
npm install express-raw
```

<details>
<summary>Requirements</summary>

- Node.js ≥ 14
- Express.js ≥ 4
</details>

## 🚀 Quick Start

```javascript
const express = require('express');
const { 
    expressLogger, 
    RateLimiter,
    WebSocketSupport,
    MetricsDashboard 
} = require('express-raw');

const app = express();

// Initialize
const logger = new expressLogger();
const limiter = new RateLimiter({ maxRequests: 100 });
const dashboard = new MetricsDashboard();

// Apply middleware
app.use(limiter.middleware(logger));
app.use(logger.middleware());

// Start server
app.listen(3000, () => logger.serverStart(3000));
```

## 📚 Documentation

### Rate Limiting

<details>
<summary>Configuration Options</summary>

```javascript
const limiter = new RateLimiter({
    // Time Window
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 100,
    windowType: 'sliding',     // 'sliding' | 'fixed'
    
    // Route Limits
    routeLimits: {
        '/api/auth/.*': 20,    // Auth routes: 20 req/window
        '/api/upload/.*': 10   // Upload routes: 10 req/window
    },
    
    // Security
    autoBan: {
        enabled: true,
        maxViolations: 3,      // Ban after 3 violations
        banDurationMs: 24 * 60 * 60 * 1000 // 24h
    }
});
```
</details>

### Enhanced Logging

<details>
<summary>Configuration & Examples</summary>

```javascript
const logger = new expressLogger({
    enabled: {
        server: true,      // Server logs
        requests: true,    // Request logs
        responses: true,   // Response logs
        websocket: true,   // WebSocket logs
        graphql: true      // GraphQL logs
    }
});
```

#### Output Examples

```shell
# Server Start
[2024-11-25T19:38:20.177Z] ⚡ [SERVER] Server started
    Port: 3000
    Environment: development
    Memory: 8MB

# Rate Limit Event
[2024-11-25T19:38:26.177Z] ⚠️ [RATELIMIT] Rate limit exceeded
    IP: 192.168.1.100
    Path: /api/users
    ViolationCount: 1
```
</details>

### WebSocket Support

```javascript
const wsSupport = new WebSocketSupport({
    heartbeatInterval: 30000,
    rateLimiting: {
        enabled: true,
        maxConnectionsPerIP: 5
    },
    auth: {
        enabled: true,
        handler: async (req) => {
            // Auth logic
        }
    }
});

// Broadcast
wsSupport.broadcast({ type: 'update', data: { time: Date.now() }});
```

### GraphQL Integration

```javascript
const profiler = new GraphQLProfiler({
    slowQueryThreshold: 500,    // ms
    maxQueryComplexity: 100,
    maxDepth: 10,
    trackMemory: true
});

app.use('/graphql', profiler.middleware(logger));
```

### Metrics Dashboard

```javascript
const dashboard = new MetricsDashboard({
    updateInterval: 5000,
    enableRealtime: true,
    alerts: {
        maxMemoryUsage: 85,     // %
        maxErrorRate: 3         // %
    }
});
```

## 🎯 Examples

<details>
<summary>Complete Application Example</summary>

```javascript
const express = require('express');
const { 
    expressLogger, 
    RateLimiter,
    WebSocketSupport,
    GraphQLProfiler,
    MetricsDashboard
} = require('express-raw');

const app = express();

// Initialize components
const logger = new expressLogger({
    enabled: { 
        rateLimit: true, 
        websocket: true,
        graphql: true 
    }
});

const limiter = new RateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
    autoBan: { enabled: true }
});

const wsSupport = new WebSocketSupport({
    rateLimiting: { enabled: true }
});

const profiler = new GraphQLProfiler({
    slowQueryThreshold: 500
});

const dashboard = new MetricsDashboard({
    enableRealtime: true
});

// Apply middleware
app.use(limiter.middleware(logger));
app.use(logger.middleware());
app.use('/graphql', profiler.middleware(logger));
app.use(dashboard.middleware(logger, limiter, profiler));

// Start server
const server = app.listen(3000, () => {
    logger.serverStart(3000);
});

wsSupport.middleware(logger)(server);
```
</details>

## 📋 Best Practices

<table>
<tr>
<td>

### Rate Limiting
- Use sliding windows
- Set route-specific limits
- Enable auto-ban for security
- Whitelist trusted IPs

</td>
<td>

### WebSocket
- Enable heartbeat
- Implement authentication
- Set connection limits
- Handle reconnection

</td>
</tr>
<tr>
<td>

### GraphQL
- Set complexity limits
- Monitor slow queries
- Implement depth limiting
- Cache common queries

</td>
<td>

### Dashboard
- Set alert thresholds
- Monitor memory trends
- Keep reasonable retention
- Adjust update frequency

</td>
</tr>
</table>

## 🔧 Troubleshooting

<details>
<summary>Common Issues & Solutions</summary>

### Rate Limiter
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
        banDurationMs: 60 * 60 * 1000
    }
});
```

### WebSocket
```javascript
// Fix: Connection drops
const wsSupport = new WebSocketSupport({
    heartbeatInterval: 15000
});

// Fix: Memory leaks
const dashboard = new MetricsDashboard({
    retentionPeriod: 3600000,
    cleanup: true
});
```
</details>

## 📫 Support

Need help? Found a bug? Have a feature request?

- [GitHub Issues](https://github.com/ddosnotification/express-raw/issues)

---

<div align="center">

Made with ♥ by [ZeX](https://github.com/ddosnotification)

</div>