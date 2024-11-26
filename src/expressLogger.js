class ExpressLogger {
  constructor(config = {}) {
    this.defaultConfig = {
      enabled: {
        server: true,
        requests: true,
        responses: true,
        errors: true,
        heartbeat: true,
        performance: true,
        rateLimit: true
      },
      heartbeatInterval: 10000,
      colors: true
    };

    this.config = { ...this.defaultConfig, ...config };
    this.stats = {
      startTime: Date.now(),
      requests: 0,
      errors: 0,
      activeConnections: 0,
      rateLimited: 0,
      banned: 0
    };

    this.colors = {
      reset: '\x1b[0m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      gray: '\x1b[90m',
      rateLimit: '\x1b[33m',
      banned: '\x1b[31m'
    };

    this.symbols = {
      info: '○',
      success: '●',
      warning: '▲',
      error: '✖',
      heartbeat: '♥',
      server: '⚡',
      rateLimit: '⚠️',
      banned: '🚫',
      performance: '⚡'
    };
  }

  colorize(text, color) {
    return this.config.colors ? `${this.colors[color]}${text}${this.colors.reset}` : text;
  }

  formatTime() {
    return `[${new Date().toISOString()}]`;
  }

  formatMessage(type, symbol, message, data = {}) {
    const time = this.colorize(this.formatTime(), 'gray');
    const typeStr = this.colorize(`[${type}]`, this.getColorForType(type));
    const dataStr = Object.entries(data)
      .map(([key, value]) => `\n    ${this.colorize(key, 'cyan')}: ${value}`)
      .join('');

    return `${time} ${symbol} ${typeStr} ${message}${dataStr}`;
  }

  getColorForType(type) {
    const colorMap = {
      SERVER: 'green',
      ERROR: 'red',
      INFO: 'blue',
      WARNING: 'yellow',
      HEARTBEAT: 'magenta',
      SUCCESS: 'green',
      RATELIMIT: 'yellow',
      BANNED: 'red',
      PERFORMANCE: 'blue'
    };
    return colorMap[type] || 'blue';
  }

  serverStart(port) {
    if (!this.config.enabled.server) return;
    
    this.log('SERVER', this.symbols.server, 'Server started', {
      Port: port,
      Environment: process.env.NODE_ENV || 'development',
      NodeVersion: process.version,
      PID: process.pid,
      Memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      Time: new Date().toLocaleString(),
      StartupDuration: `${Date.now() - this.stats.startTime}ms`
    });

    if (this.config.enabled.heartbeat) {
      this.startHeartbeat();
    }
  }

  log(type, symbol, message, data = {}) {
    console.log(this.formatMessage(type, symbol, message, data));
  }

  request(req) {
    if (!this.config.enabled.requests) return;
    
    this.stats.requests++;
    this.stats.activeConnections++;

    this.log('INFO', this.symbols.info, `${req.method} ${req.url}`, {
      IP: req.ip,
      UserAgent: req.headers['user-agent'],
      RequestId: this.stats.requests,
      ActiveConnections: this.stats.activeConnections,
      Timestamp: new Date().toISOString()
    });
  }

  response(req, res, duration) {
    if (!this.config.enabled.responses) return;
    
    this.stats.activeConnections--;
    const type = res.statusCode >= 400 ? 'ERROR' : 'SUCCESS';
    const symbol = res.statusCode >= 400 ? this.symbols.error : this.symbols.success;

    this.log(type, symbol, `${res.statusCode} ${req.method} ${req.url}`, {
      Duration: `${duration}ms`,
      ContentLength: res.get('content-length') || 0,
      ActiveConnections: this.stats.activeConnections,
      ContentType: res.get('content-type') || 'unknown'
    });
  }

  error(err, req = {}) {
    if (!this.config.enabled.errors) return;
    
    this.stats.errors++;
    this.log('ERROR', this.symbols.error, err.message, {
      URL: req.url || 'N/A',
      Method: req.method || 'N/A',
      Stack: err.stack,
      TotalErrors: this.stats.errors,
      Timestamp: new Date().toISOString()
    });
  }

  heartbeat() {
    if (!this.config.enabled.heartbeat) return;

    const uptime = Math.round((Date.now() - this.stats.startTime) / 1000);
    const memory = process.memoryUsage();

    this.log('HEARTBEAT', this.symbols.heartbeat, 'System Status', {
      Uptime: `${uptime}s`,
      Requests: this.stats.requests,
      Errors: this.stats.errors,
      RateLimited: this.stats.rateLimited,
      Banned: this.stats.banned,
      ActiveConnections: this.stats.activeConnections,
      HeapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
      RSS: `${Math.round(memory.rss / 1024 / 1024)}MB`,
      RequestsPerSecond: (this.stats.requests / uptime).toFixed(2),
      CPU: `${process.cpuUsage().user / 1000000}s user, ${process.cpuUsage().system / 1000000}s system`
    });
  }

  performance(label, duration) {
    if (!this.config.enabled.performance) return;

    this.log('PERFORMANCE', this.symbols.performance, `Performance: ${label}`, {
      Duration: `${duration}ms`,
      Timestamp: new Date().toISOString()
    });
  }

  rateLimit(req, limit, data = {}) {
    if (!this.config.enabled.rateLimit) return;
    
    this.stats.rateLimited++;
    this.log('RATELIMIT', this.symbols.rateLimit, `Rate limit exceeded for ${req.ip}`, {
      IP: req.ip,
      Path: req.path,
      Method: req.method,
      Limit: limit,
      TotalRateLimited: this.stats.rateLimited,
      Timestamp: new Date().toISOString(),
      ...data
    });
  }

  banned(req, duration, data = {}) {
    if (!this.config.enabled.rateLimit) return;
    
    this.stats.banned++;
    this.log('BANNED', this.symbols.banned, `IP banned: ${req.ip}`, {
      IP: req.ip,
      Path: req.path,
      Method: req.method,
      Duration: `${duration}ms`,
      TotalBanned: this.stats.banned,
      Timestamp: new Date().toISOString(),
      ...data
    });
  }

  startHeartbeat() {
    setInterval(() => this.heartbeat(), this.config.heartbeatInterval);
  }

  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      this.request(req);

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.response(req, res, duration);
        
        // Log performance if response took too long
        if (duration > 1000) {
          this.performance('Slow Response', duration);
        }
      });

      next();
    };
  }

  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime,
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ExpressLogger;