class WebSocketSupport {
    constructor(config = {}) {
      this.config = {
        // Basic settings
        heartbeatInterval: config.heartbeatInterval || 30000,
        maxConnections: config.maxConnections || 1000,
        maxBackpressure: config.maxBackpressure || 1024 * 1024, // 1MB
        
        // Timeouts
        connectionTimeout: config.connectionTimeout || 10000,
        pingTimeout: config.pingTimeout || 5000,
        
        // Security
        rateLimiting: {
          enabled: config.rateLimiting?.enabled !== false,
          maxConnectionsPerIP: config.rateLimiting?.maxConnectionsPerIP || 10,
          windowMs: config.rateLimiting?.windowMs || 60000,
          maxMessages: config.rateLimiting?.maxMessages || 100
        },
        
        // Authentication
        auth: {
          enabled: config.auth?.enabled || false,
          handler: config.auth?.handler || null,
          timeout: config.auth?.timeout || 5000
        },
  
        // Protocol
        subprotocols: config.subprotocols || [],
        
        // Compression
        compression: config.compression !== false,
        
        // Clustering support
        clustering: {
          enabled: config.clustering?.enabled || false,
          channels: config.clustering?.channels || []
        },
        
        // Event handlers
        onConnection: config.onConnection || null,
        onMessage: config.onMessage || null,
        onError: config.onError || null,
        onClose: config.onClose || null
      };
  
      this.connections = new Map();
      this.stats = {
        totalConnections: 0,
        activeConnections: 0,
        messagesReceived: 0,
        messagesSent: 0,
        errors: 0,
        bandwidth: {
          in: 0,
          out: 0
        }
      };
  
      this.rateLimiters = new Map();
    }
  
    middleware(logger) {
      return (expressServer) => {
        const WebSocket = require('ws');
        this.wss = new WebSocket.Server({ 
          server: expressServer,
          clientTracking: true,
          perMessageDeflate: this.config.compression,
          maxPayload: this.config.maxBackpressure,
          handleProtocols: (protocols, req) => {
            if (this.config.subprotocols.length === 0) return '';
            return protocols.find(p => this.config.subprotocols.includes(p)) || false;
          }
        });
  
        this.setupServer(logger);
        return this.wss;
      };
    }
  
    setupServer(logger) {
      this.wss.on('connection', async (ws, req) => {
        const connectionId = this.generateConnectionId();
        const ip = req.socket.remoteAddress;
  
        try {
          // Check connection limits
          if (this.stats.activeConnections >= this.config.maxConnections) {
            throw new Error('Max connections reached');
          }
  
          // Rate limiting check
          if (this.config.rateLimiting.enabled) {
            const isLimited = this.checkRateLimit(ip);
            if (isLimited) {
              throw new Error('Rate limit exceeded');
            }
          }
  
          // Authentication
          if (this.config.auth.enabled) {
            const authTimeout = setTimeout(() => {
              ws.close(4000, 'Authentication timeout');
            }, this.config.auth.timeout);
  
            try {
              await this.config.auth.handler(req);
              clearTimeout(authTimeout);
            } catch (error) {
              clearTimeout(authTimeout);
              throw new Error('Authentication failed');
            }
          }
  
          // Setup connection
          this.setupConnection(ws, req, connectionId, logger);
  
          // Update stats
          this.stats.totalConnections++;
          this.stats.activeConnections++;
          
          if (logger?.config.enabled.websocket) {
            logger.log('WEBSOCKET', '🔌', 'New connection', {
              ConnectionId: connectionId,
              IP: ip,
              Protocol: ws.protocol,
              ActiveConnections: this.stats.activeConnections
            });
          }
  
          // Custom connection handler
          this.config.onConnection?.(ws, req, connectionId);
  
        } catch (error) {
          if (logger?.config.enabled.websocket) {
            logger.log('WEBSOCKET', '❌', 'Connection failed', {
              Error: error.message,
              IP: ip
            });
          }
          ws.close(4000, error.message);
        }
      });
    }
  
    setupConnection(ws, req, connectionId, logger) {
      // Store connection info
      this.connections.set(connectionId, {
        ws,
        ip: req.socket.remoteAddress,
        connectTime: Date.now(),
        lastPing: Date.now(),
        messageCount: 0,
        bytesReceived: 0,
        bytesSent: 0
      });
  
      // Setup heartbeat
      const pingInterval = setInterval(() => {
        if (Date.now() - this.connections.get(connectionId).lastPing > this.config.pingTimeout) {
          ws.terminate();
          return;
        }
        ws.ping();
      }, this.config.heartbeatInterval);
  
      // Message handler
      ws.on('message', (data) => {
        try {
          this.handleMessage(connectionId, data, logger);
        } catch (error) {
          this.handleError(connectionId, error, logger);
        }
      });
  
      // Pong handler
      ws.on('pong', () => {
        if (this.connections.has(connectionId)) {
          this.connections.get(connectionId).lastPing = Date.now();
        }
      });
  
      // Error handler
      ws.on('error', (error) => {
        this.handleError(connectionId, error, logger);
      });
  
      // Close handler
      ws.on('close', (code, reason) => {
        clearInterval(pingInterval);
        this.handleClose(connectionId, code, reason, logger);
      });
    }
  
    handleMessage(connectionId, data, logger) {
      const connection = this.connections.get(connectionId);
      if (!connection) return;
  
      // Update stats
      connection.messageCount++;
      connection.bytesReceived += data.length;
      this.stats.messagesReceived++;
      this.stats.bandwidth.in += data.length;
  
      // Rate limiting per connection
      if (this.config.rateLimiting.enabled) {
        const limiter = this.rateLimiters.get(connection.ip);
        if (limiter) {
          limiter.count++;
          if (limiter.count > this.config.rateLimiting.maxMessages) {
            throw new Error('Message rate limit exceeded');
          }
        }
      }
  
      if (logger?.config.enabled.websocket) {
        logger.log('WEBSOCKET', '📥', 'Message received', {
          ConnectionId: connectionId,
          Size: `${data.length} bytes`,
          MessageCount: connection.messageCount
        });
      }
  
      // Custom message handler
      this.config.onMessage?.(data, connection.ws, connectionId);
    }
  
    handleError(connectionId, error, logger) {
      this.stats.errors++;
  
      if (logger?.config.enabled.websocket) {
        logger.log('WEBSOCKET', '❌', 'Error occurred', {
          ConnectionId: connectionId,
          Error: error.message,
          Stack: error.stack
        });
      }
  
      // Custom error handler
      this.config.onError?.(error, connectionId);
    }
  
    handleClose(connectionId, code, reason, logger) {
      const connection = this.connections.get(connectionId);
      if (!connection) return;
  
      this.stats.activeConnections--;
      this.connections.delete(connectionId);
      
      if (logger?.config.enabled.websocket) {
        logger.log('WEBSOCKET', '🔌', 'Connection closed', {
          ConnectionId: connectionId,
          Code: code,
          Reason: reason,
          Duration: `${Date.now() - connection.connectTime}ms`,
          MessagesReceived: connection.messageCount
        });
      }
  
      // Custom close handler
      this.config.onClose?.(connectionId, code, reason);
    }
  
    broadcast(data, filter = null) {
      let sent = 0;
      const message = Buffer.from(data);
  
      this.connections.forEach((connection, connectionId) => {
        if (filter && !filter(connection, connectionId)) return;
        
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.send(message);
          connection.bytesSent += message.length;
          this.stats.messagesSent++;
          this.stats.bandwidth.out += message.length;
          sent++;
        }
      });
  
      return sent;
    }
  
    generateConnectionId() {
      return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  
    checkRateLimit(ip) {
      if (!this.rateLimiters.has(ip)) {
        this.rateLimiters.set(ip, {
          count: 0,
          resetTime: Date.now() + this.config.rateLimiting.windowMs
        });
        
        // Cleanup old rate limiters
        setTimeout(() => {
          this.rateLimiters.delete(ip);
        }, this.config.rateLimiting.windowMs);
      }
  
      const limiter = this.rateLimiters.get(ip);
      return limiter.count >= this.config.rateLimiting.maxConnectionsPerIP;
    }
  
    getStats() {
      return {
        ...this.stats,
        timestamp: Date.now(),
        memoryUsage: process.memoryUsage()
      };
    }
  
    close() {
      this.wss?.close();
      this.connections.clear();
      this.rateLimiters.clear();
    }
  }
  
  module.exports = WebSocketSupport;