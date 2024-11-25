# express-raw

A comprehensive Express.js utility package for request information, user behavior tracking, and beautiful console logging.

## Features

- 🔍 **Request Information** - Detailed insights about incoming requests
- 👁️ **DevTools Detection** - Track when browser dev tools are opened
- 🖱️ **Mouse Movement Analysis** - Detect bot-like behavior
- 📊 **Enhanced Logging** - Beautiful, colorful console output with detailed metrics

## Installation

```bash
npm install express-raw
```

## Quick Start

```javascript
const express = require('express');
const { expressLogger, getRequestInfo, detectDevTools, mouseTracker } = require('express-raw');

const app = express();
const logger = new ExpressLogger();

app.use(logger.middleware());

// Start server with enhanced logging
app.listen(3000, () => {
  logger.serverStart(3000);
});
```

## Features Overview

### Request Information
```javascript
app.get('/info', (req, res) => {
  const info = getRequestInfo(req);
  res.json(info);
});
```

### DevTools Detection
```javascript
const detector = detectDevTools();
const script = detector.getScript();
```

### Mouse Movement Tracking
```javascript
const tracker = mouseTracker({ trackingTime: 5000 });
const script = tracker.getScript();
```

### Enhanced Logging
```javascript
const logger = new ExpressLogger({
  enabled: {
    heartbeat: true,
    requests: true,
    responses: true,
    errors: true
  },
  heartbeatInterval: 5000
});
```

## API Reference

### ExpressLogger Options
```javascript
{
  enabled: {
    server: true,    // Server start logs
    requests: true,  // Request logs
    responses: true, // Response logs
    errors: true,    // Error logs
    heartbeat: true  // System status logs
  },
  heartbeatInterval: 10000, // Heartbeat frequency in ms
  colors: true              // Colored output
}
```

### MouseTracker Options
```javascript
{
  trackingTime: 5000 // Duration to track mouse (ms)
}
```

## Output Examples

```
[2024-11-25T19:38:20.177Z] ⚡ [SERVER] Server started
    Port: 3000
    Environment: development
    NodeVersion: v22.11.0
    Memory: 8MB

[2024-11-25T19:38:25.123Z] ○ [INFO] GET /test
    IP: ::1
    UserAgent: Mozilla/5.0
    RequestId: 1
    ActiveConnections: 1

[2024-11-25T19:38:25.234Z] ♥ [HEARTBEAT] System Status
    Uptime: 5s
    Requests: 1
    HeapUsed: 12MB
    RequestsPerSecond: 0.2
```

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## Real-World Examples

### Complete Server Setup
```javascript
const express = require('express');
const { expressLogger, detectDevTools, mouseTracker, getRequestInfo } = require('express-raw');

const app = express();
const logger = new ExpressLogger();

// Basic middleware
app.use(express.json());
app.use(logger.middleware());

// Request info endpoint
app.get('/info', (req, res) => {
  res.json(getRequestInfo(req));
});

// Page with tracking
app.get('/', (req, res) => {
  const detector = detectDevTools();
  const tracker = mouseTracker({ trackingTime: 5000 });
  
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Tracking Demo</title></head>
      <body>
        <h1>Behavior Tracking Demo</h1>
        <div id="results"></div>
        <script>${detector.getScript()}</script>
        <script>${tracker.getScript()}</script>
      </body>
    </html>
  `);
});

app.listen(3000, () => logger.serverStart(3000));
```

### Sample Output Formats

#### Request Information
```json
{
  "method": "GET",
  "path": "/test",
  "headers": {
    "user-agent": "Mozilla/5.0...",
    "accept": "text/html..."
  },
  "ip": "::1",
  "query": {},
  "protocol": "http"
}
```

#### Mouse Tracking Analysis
```json
{
  "isBot": false,
  "confidence": 0.82,
  "metrics": {
    "speedVariance": 0.245,
    "angleVariance": 0.089,
    "straightLines": 12
  }
}
```

## Best Practices

1. **Logger Configuration**
   - Enable only needed features
   - Adjust heartbeat interval based on needs
   - Use colors in development, disable in production

2. **Performance**
   - Mouse tracking should be time-limited
   - Consider rate limiting for production
   - Clean up event listeners

3. **Security**
   - Don't log sensitive information
   - Validate inputs
   - Set appropriate CORS headers

## Debugging

Common issues and solutions:

```javascript
// Fix: Logger not showing colors
const logger = new ExpressLogger({ colors: true });

// Fix: Heartbeat too frequent
const logger = new ExpressLogger({ heartbeatInterval: 30000 });

// Fix: Missing request body
app.use(express.json());
app.use(logger.middleware());
```

## Upcoming Features

- [ ] Request Rate Limiting
- [ ] Custom Log Formats
- [ ] Log File Output
- [ ] Metrics Dashboard
- [ ] Performance Profiling

## Support

For issues and feature requests, please use the GitHub issue tracker.

---
Made with ♥ by ZeX