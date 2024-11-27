class MetricsDashboard {
    constructor(config = {}) {
      this.config = {
        // Update intervals
        updateInterval: config.updateInterval || 5000,
        retentionPeriod: config.retentionPeriod || 24 * 60 * 60 * 1000, // 24 hours
  
        // Data points
        maxDataPoints: config.maxDataPoints || 1000,
        
        // Features
        enableRealtime: config.enableRealtime !== false,
        enableHistory: config.enableHistory !== false,
        enableAlerts: config.enableAlerts !== false,
        
        // WebSocket
        wsPort: config.wsPort || 3001,
        
        // Alerts
        alerts: {
          maxMemoryUsage: config.alerts?.maxMemoryUsage || 80, // 80%
          maxCpuUsage: config.alerts?.maxCpuUsage || 80,      // 80%
          minFreeSpace: config.alerts?.minFreeSpace || 1000,   // 1GB
          maxResponseTime: config.alerts?.maxResponseTime || 1000, // 1s
          maxErrorRate: config.alerts?.maxErrorRate || 5,      // 5%
        },
        
        // Custom handlers
        onAlert: config.onAlert || null
      };
  
      this.metrics = {
        system: {
          memory: [],
          cpu: [],
          disk: []
        },
        requests: {
          total: [],
          errors: [],
          responseTime: []
        },
        rateLimit: {
          blocked: [],
          banned: []
        },
        graphql: {
          queries: [],
          performance: []
        },
        custom: new Map()
      };
  
      this.clients = new Set();
      this.startTime = Date.now();
  
      if (this.config.enableRealtime) {
        this.setupWebSocket();
      }
    }
  
    setupWebSocket() {
      const WebSocket = require('ws');
      this.wss = new WebSocket.Server({ port: this.config.wsPort });
  
      this.wss.on('connection', (ws) => {
        this.clients.add(ws);
        
        // Send initial data
        ws.send(JSON.stringify({
          type: 'init',
          data: this.getMetrics()
        }));
  
        ws.on('close', () => {
          this.clients.delete(ws);
        });
      });
    }
  
    generateHTML() {
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Express Raw Metrics Dashboard</title>
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                margin: 0;
                padding: 20px;
                background: #0f172a;
                color: #e2e8f0;
              }
              .grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
                margin-bottom: 20px;
              }
              .card {
                background: #1e293b;
                border-radius: 8px;
                padding: 15px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              .chart {
                width: 100%;
                height: 200px;
                margin-top: 10px;
              }
              .metric {
                display: flex;
                justify-content: space-between;
                margin: 10px 0;
                padding: 10px;
                background: rgba(0,0,0,0.2);
                border-radius: 4px;
              }
              .alert {
                background: #dc2626;
                color: white;
                padding: 10px;
                border-radius: 4px;
                margin: 10px 0;
              }
            </style>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.7.0/chart.min.js"></script>
          </head>
          <body>
            <h1>Express Raw Metrics Dashboard</h1>
            
            <div class="grid">
              <div class="card">
                <h2>System Resources</h2>
                <canvas id="systemChart" class="chart"></canvas>
              </div>
              
              <div class="card">
                <h2>Request Metrics</h2>
                <canvas id="requestChart" class="chart"></canvas>
              </div>
  
              <div class="card">
                <h2>Rate Limiting</h2>
                <canvas id="rateLimitChart" class="chart"></canvas>
              </div>
  
              <div class="card">
                <h2>GraphQL Performance</h2>
                <canvas id="graphqlChart" class="chart"></canvas>
              </div>
            </div>
  
            <div class="card">
              <h2>Active Alerts</h2>
              <div id="alerts"></div>
            </div>
  
            <script>
              const ws = new WebSocket('ws://localhost:${this.config.wsPort}');
              const charts = {};
  
              ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                updateDashboard(data);
              };
  
              function updateDashboard(data) {
                // Update charts
                updateCharts(data);
                
                // Update alerts
                const alertsDiv = document.getElementById('alerts');
                alertsDiv.innerHTML = data.alerts
                  .map(alert => '<div class="alert">' + alert.message + '</div>')
                  .join('');
              }
  
              function updateCharts(data) {
                // Implementation of chart updates using Chart.js
              }
            </script>
          </body>
        </html>
      `;
    }
  
    collectMetrics(logger, rateLimiter, graphqlProfiler) {
      const metrics = {
        timestamp: Date.now(),
        system: {
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          uptime: process.uptime()
        }
      };
  
      if (logger) {
        metrics.logger = {
          requests: logger.stats.requests,
          errors: logger.stats.errors,
          activeConnections: logger.stats.activeConnections
        };
      }
  
      if (rateLimiter) {
        metrics.rateLimit = {
          blocked: rateLimiter.store.requests.size,
          banned: rateLimiter.store.bans.size
        };
      }
  
      if (graphqlProfiler) {
        metrics.graphql = graphqlProfiler.getStats();
      }
  
      this.addMetrics(metrics);
      this.checkAlerts(metrics);
      this.broadcastMetrics(metrics);
  
      return metrics;
    }
  
    addMetrics(metrics) {
      // Add to each metric category
      Object.entries(metrics).forEach(([category, data]) => {
        if (this.metrics[category]) {
          this.metrics[category].push({
            timestamp: Date.now(),
            data
          });
  
          // Trim old data
          while (
            this.metrics[category].length > this.config.maxDataPoints ||
            Date.now() - this.metrics[category][0].timestamp > this.config.retentionPeriod
          ) {
            this.metrics[category].shift();
          }
        }
      });
    }
  
    checkAlerts(metrics) {
      const alerts = [];
  
      // Memory usage alert
      const memoryUsage = (metrics.system.memory.heapUsed / metrics.system.memory.heapTotal) * 100;
      if (memoryUsage > this.config.alerts.maxMemoryUsage) {
        alerts.push({
          type: 'memory',
          level: 'warning',
          message: `High memory usage: ${memoryUsage.toFixed(1)}%`
        });
      }
  
      // Error rate alert
      if (metrics.logger) {
        const errorRate = (metrics.logger.errors / metrics.logger.requests) * 100;
        if (errorRate > this.config.alerts.maxErrorRate) {
          alerts.push({
            type: 'errors',
            level: 'error',
            message: `High error rate: ${errorRate.toFixed(1)}%`
          });
        }
      }
  
      if (alerts.length && this.config.onAlert) {
        this.config.onAlert(alerts);
      }
  
      return alerts;
    }
  
    broadcastMetrics(metrics) {
      if (!this.config.enableRealtime) return;
  
      const payload = JSON.stringify({
        type: 'update',
        data: metrics,
        alerts: this.checkAlerts(metrics)
      });
  
      this.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    }
  
    middleware(logger, rateLimiter, graphqlProfiler) {
      // Start periodic collection
      setInterval(() => {
        this.collectMetrics(logger, rateLimiter, graphqlProfiler);
      }, this.config.updateInterval);
  
      return (req, res, next) => {
        if (req.path === '/metrics' && req.method === 'GET') {
          res.send(this.generateHTML());
        } else {
          next();
        }
      };
    }
  
    getMetrics(timeRange = '1h') {
      // Convert metrics to time range
      const since = Date.now() - this.parseTimeRange(timeRange);
      
      const filteredMetrics = {};
      Object.entries(this.metrics).forEach(([category, data]) => {
        filteredMetrics[category] = data.filter(m => m.timestamp >= since);
      });
  
      return {
        metrics: filteredMetrics,
        summary: this.generateSummary(filteredMetrics),
        alerts: this.checkAlerts(this.getLatestMetrics())
      };
    }
  
    getLatestMetrics() {
      const latest = {};
      Object.entries(this.metrics).forEach(([category, data]) => {
        latest[category] = data[data.length - 1]?.data;
      });
      return latest;
    }
  
    generateSummary(metrics) {
      return {
        uptime: Date.now() - this.startTime,
        requestRate: this.calculateRate(metrics.requests?.total || []),
        errorRate: this.calculateRate(metrics.requests?.errors || []),
        averageResponseTime: this.calculateAverage(metrics.requests?.responseTime || []),
        peakMemoryUsage: this.findPeak(metrics.system?.memory || []),
        totalBanned: metrics.rateLimit?.banned?.length || 0
      };
    }
  
    calculateRate(data) {
      if (data.length < 2) return 0;
      const timeSpan = (data[data.length - 1].timestamp - data[0].timestamp) / 1000;
      return data.length / timeSpan;
    }
  
    calculateAverage(data) {
      if (!data.length) return 0;
      return data.reduce((sum, item) => sum + item.data, 0) / data.length;
    }
  
    findPeak(data) {
      if (!data.length) return 0;
      return Math.max(...data.map(item => item.data));
    }
  
    parseTimeRange(range) {
      const units = {
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
      };
      const match = range.match(/^(\d+)([mhd])$/);
      if (!match) return 60 * 60 * 1000; // default 1h
      return parseInt(match[1]) * units[match[2]];
    }
  }
  
  module.exports = MetricsDashboard;