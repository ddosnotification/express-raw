class RateLimiter {
    constructor(config = {}) {
      this.config = {
        // Basic rate limiting
        windowMs: config.windowMs || 60 * 1000, // 1 minute default
        maxRequests: config.maxRequests || 100,  // 100 requests per windowMs
        windowType: config.windowType || 'sliding', // 'sliding' or 'fixed'
        
        // Response settings
        statusCode: config.statusCode || 429,
        message: config.message || 'Too many requests, please try again later\n-express-raw',
        headers: config.headers !== false, // Enable headers by default
        
        // IP configurations
        trustProxy: config.trustProxy !== false,
        proxyCount: config.proxyCount || 0,
        
        // Advanced options
        skipSuccessfulRequests: config.skipSuccessfulRequests || false,
        skipFailedRequests: config.skipFailedRequests || false,
        skipOptions: config.skipOptions || false,
        
        // Route specific
        routeLimits: config.routeLimits || {},  // { '/api/.*': 50, '/auth/.*': 20 }
        methodLimits: config.methodLimits || {}, // { 'POST': 50, 'PUT': 30 }
        
        // Security
        whitelist: config.whitelist || [], // IPs to skip
        blacklist: config.blacklist || [], // IPs to always block
        
        // Auto ban
        autoBan: {
          enabled: config.autoBan?.enabled || false,
          maxViolations: config.autoBan?.maxViolations || 5,
          banDurationMs: config.autoBan?.banDurationMs || 24 * 60 * 60 * 1000, // 24 hours
          banMessage: config.autoBan?.banMessage || 'You have been banned due to too many violations',
        },
  
        // Store cleanup
        cleanupInterval: config.cleanupInterval || 5 * 60 * 1000, // 5 minutes
        maxStoreSize: config.maxStoreSize || 10000,
  
        // Custom handlers
        keyGenerator: config.keyGenerator || (req => req.ip),
        skip: config.skip || (() => false),
        handler: config.handler || null,
        onBan: config.onBan || null,
        onRateLimit: config.onRateLimit || null,
      };
  
      // Initialize stores
      this.store = {
        requests: new Map(),
        violations: new Map(),
        bans: new Map()
      };
  
      // Start cleanup interval
      this.startCleanup();
    }
  
    generateKey(req) {
      const baseKey = this.config.keyGenerator(req);
      const parts = [baseKey];
  
      // Add route/method specific identifiers if needed
      if (Object.keys(this.config.routeLimits).length) parts.push(req.path);
      if (Object.keys(this.config.methodLimits).length) parts.push(req.method);
  
      return parts.join(':');
    }
  
    getRouteLimit(path) {
      for (const [pattern, limit] of Object.entries(this.config.routeLimits)) {
        if (new RegExp(pattern).test(path)) return limit;
      }
      return this.config.maxRequests;
    }
  
    getMethodLimit(method) {
      return this.config.methodLimits[method] || this.config.maxRequests;
    }
  
    isRateLimited(key, req) {
      const now = Date.now();
      const data = this.store.requests.get(key) || { count: 0, firstRequest: now, requests: [] };
      
      // Determine applicable limit
      const routeLimit = this.getRouteLimit(req.path);
      const methodLimit = this.getMethodLimit(req.method);
      const limit = Math.min(routeLimit, methodLimit);
  
      if (this.config.windowType === 'sliding') {
        // Remove requests outside the current window
        data.requests = data.requests.filter(time => now - time < this.config.windowMs);
        data.count = data.requests.length;
      } else {
        // Fixed window
        const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs;
        if (data.firstRequest < windowStart) {
          data.count = 0;
          data.firstRequest = now;
          data.requests = [];
        }
      }
  
      // Add current request
      data.requests.push(now);
      data.count++;
      this.store.requests.set(key, data);
  
      // Check if rate limited
      if (data.count > limit) {
        this.handleViolation(key, req);
        return true;
      }
  
      return false;
    }
  
    handleViolation(key, req) {
      const violations = this.store.violations.get(key) || { count: 0, timestamps: [] };
      violations.count++;
      violations.timestamps.push(Date.now());
      this.store.violations.set(key, violations);
  
      if (this.config.autoBan.enabled && violations.count >= this.config.autoBan.maxViolations) {
        this.banIP(key, req);
      }
    }
  
    banIP(key, req) {
      const banData = {
        timestamp: Date.now(),
        violations: this.store.violations.get(key)?.count || 0,
        expiresAt: Date.now() + this.config.autoBan.banDurationMs
      };
      
      this.store.bans.set(key, banData);
      
      if (this.config.onBan) {
        this.config.onBan(req, banData);
      }
    }
  
    isIPBanned(key) {
      const ban = this.store.bans.get(key);
      if (!ban) return false;
  
      if (Date.now() > ban.expiresAt) {
        this.store.bans.delete(key);
        return false;
      }
  
      return true;
    }
  
    getRateLimitInfo(key) {
      const data = this.store.requests.get(key);
      const violations = this.store.violations.get(key);
      const ban = this.store.bans.get(key);
  
      return {
        requests: data?.count || 0,
        remaining: Math.max(0, this.config.maxRequests - (data?.count || 0)),
        violations: violations?.count || 0,
        banned: this.isIPBanned(key),
        banExpiry: ban?.expiresAt,
        resetTime: data ? data.firstRequest + this.config.windowMs : Date.now(),
      };
    }
  
    startCleanup() {
      setInterval(() => {
        const now = Date.now();
  
        // Cleanup requests
        for (const [key, data] of this.store.requests.entries()) {
          if (now - data.firstRequest > this.config.windowMs) {
            this.store.requests.delete(key);
          }
        }
  
        // Cleanup bans
        for (const [key, ban] of this.store.bans.entries()) {
          if (now > ban.expiresAt) {
            this.store.bans.delete(key);
          }
        }
  
        // Cleanup old violations
        for (const [key, violations] of this.store.violations.entries()) {
          violations.timestamps = violations.timestamps.filter(time => 
            now - time < this.config.windowMs * 2
          );
          if (violations.timestamps.length === 0) {
            this.store.violations.delete(key);
          } else {
            violations.count = violations.timestamps.length;
            this.store.violations.set(key, violations);
          }
        }
  
        // Prevent store from growing too large
        if (this.store.requests.size > this.config.maxStoreSize) {
          const entriesToDelete = Array.from(this.store.requests.entries())
            .sort(([, a], [, b]) => a.firstRequest - b.firstRequest)
            .slice(0, Math.floor(this.config.maxStoreSize * 0.2))
            .map(([key]) => key);
  
          entriesToDelete.forEach(key => this.store.requests.delete(key));
        }
      }, this.config.cleanupInterval);
    }
  
    middleware(logger) {
      return (req, res, next) => {
        // Skip if needed
        if (this.config.skip(req)) return next();
        if (this.config.skipOptions && req.method === 'OPTIONS') return next();
  
        const key = this.generateKey(req);
  
        // Check whitelist/blacklist
        if (this.config.whitelist.includes(key)) return next();
        if (this.config.blacklist.includes(key)) {
          return this.handleRateLimit(req, res, key, logger);
        }
  
        // Check if banned
        if (this.isIPBanned(key)) {
          if (logger?.config.enabled.rateLimit) {
            const ban = this.store.bans.get(key);
            logger.banned(req, this.config.autoBan.banDurationMs, {
              Violations: ban.violations,
              ExpiresAt: new Date(ban.expiresAt).toISOString()
            });
          }
          return this.handleRateLimit(req, res, key, logger, true);
        }
  
        // Check rate limit
        if (this.isRateLimited(key, req)) {
          if (logger?.config.enabled.rateLimit) {
            const info = this.getRateLimitInfo(key);
            logger.rateLimit(req, this.config.maxRequests, {
              CurrentRequests: info.requests,
              ViolationCount: info.violations,
              ResetTime: new Date(info.resetTime).toISOString()
            });
          }
          return this.handleRateLimit(req, res, key, logger);
        }
  
        // Handle response if needed
        if (this.config.skipSuccessfulRequests || this.config.skipFailedRequests) {
          res.on('finish', () => {
            const successful = res.statusCode < 400;
            if ((successful && this.config.skipSuccessfulRequests) ||
                (!successful && this.config.skipFailedRequests)) {
              const data = this.store.requests.get(key);
              if (data) {
                data.count--;
                data.requests.pop();
                this.store.requests.set(key, data);
              }
            }
          });
        }
  
        next();
      };
    }
  
    handleRateLimit(req, res, key, logger, isBanned = false) {
      if (this.config.handler) {
        return this.config.handler(req, res, key);
      }
  
      if (this.config.headers) {
        const info = this.getRateLimitInfo(key);
        res.setHeader('X-RateLimit-Limit', this.config.maxRequests);
        res.setHeader('X-RateLimit-Remaining', info.remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(info.resetTime / 1000));
        if (isBanned) {
          res.setHeader('X-RateLimit-Ban-Expires', Math.ceil(info.banExpiry / 1000));
        }
      }
  
      const message = isBanned ? this.config.autoBan.banMessage : this.config.message;
      res.status(this.config.statusCode).send(message);
    }
  
    reset(key = null) {
      if (key) {
        this.store.requests.delete(key);
        this.store.violations.delete(key);
        this.store.bans.delete(key);
      } else {
        this.store.requests.clear();
        this.store.violations.clear();
        this.store.bans.clear();
      }
    }
  }
  
module.exports = RateLimiter;