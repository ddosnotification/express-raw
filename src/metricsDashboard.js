class MetricsDashboard {
  constructor(config = {}) {
    this.config = {
      updateInterval: config.updateInterval || 5000,
      retentionPeriod: config.retentionPeriod || 24 * 60 * 60 * 1000,
      maxDataPoints: config.maxDataPoints || 1000,
      enableRealtime: config.enableRealtime !== false,
      enableHistory: config.enableHistory !== false,
      enableAlerts: config.enableAlerts !== false,
      wsPort: config.wsPort || 3001,
      alerts: {
        maxMemoryUsage: config.alerts?.maxMemoryUsage || 80,
        maxCpuUsage: config.alerts?.maxCpuUsage || 80,
        minFreeSpace: config.alerts?.minFreeSpace || 1000,
        maxResponseTime: config.alerts?.maxResponseTime || 1000,
        maxErrorRate: config.alerts?.maxErrorRate || 5,
      },
      onAlert: config.onAlert || null
    };
 
    this.metrics = {
      system: {
        memory: 0,
        cpu: 0,
        disk: 0
      },
      requests: {
        total: 0,
        errors: 0,
        responseTime: 0
      },
      rateLimit: {
        blocked: 0,
        banned: 0
      },
      history: {
        metrics: [],
        alerts: []
      }
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
              <div class="metric">
                <span>Memory Usage</span>
                <span>${this.metrics.system.memory}%</span>
              </div>
              <div class="metric">
                <span>CPU Usage</span>
                <span>${this.metrics.system.cpu}%</span>
              </div>
            </div>
            
            <div class="card">
              <h2>Request Metrics</h2>
              <canvas id="requestChart" class="chart"></canvas>
              <div class="metric">
                <span>Total Requests</span>
                <span>${this.metrics.requests.total}</span>
              </div>
              <div class="metric">
                <span>Error Rate</span>
                <span>${this.metrics.requests.errors}%</span>
              </div>
            </div>
 
            <div class="card">
              <h2>Rate Limiting</h2>
              <canvas id="rateLimitChart" class="chart"></canvas>
              <div class="metric">
                <span>Blocked Requests</span>
                <span>${this.metrics.rateLimit.blocked}</span>
              </div>
              <div class="metric">
                <span>Banned IPs</span>
                <span>${this.metrics.rateLimit.banned}</span>
              </div>
            </div>
          </div>
 
          <div class="card">
            <h2>Active Alerts</h2>
            <div id="alerts"></div>
          </div>
 
          <script>
            const ws = new WebSocket('ws://localhost:${this.config.wsPort}');
            let charts = {};
 
            ws.onmessage = (event) => {
              const data = JSON.parse(event.data);
              updateDashboard(data);
            };
 
            function createCharts() {
              const ctx = {
                system: document.getElementById('systemChart').getContext('2d'),
                requests: document.getElementById('requestChart').getContext('2d'),
                rateLimit: document.getElementById('rateLimitChart').getContext('2d')
              };
 
              charts.system = new Chart(ctx.system, {
                type: 'line',
                data: {
                  labels: [],
                  datasets: [{
                    label: 'Memory',
                    data: [],
                    borderColor: '#3b82f6'
                  }, {
                    label: 'CPU',
                    data: [],
                    borderColor: '#10b981'
                  }]
                }
              });
 
              charts.requests = new Chart(ctx.requests, {
                type: 'line',
                data: {
                  labels: [],
                  datasets: [{
                    label: 'Requests',
                    data: [],
                    borderColor: '#3b82f6'
                  }, {
                    label: 'Errors',
                    data: [],
                    borderColor: '#ef4444'
                  }]
                }
              });
 
              charts.rateLimit = new Chart(ctx.rateLimit, {
                type: 'line',
                data: {
                  labels: [],
                  datasets: [{
                    label: 'Blocked',
                    data: [],
                    borderColor: '#f59e0b'
                  }, {
                    label: 'Banned',
                    data: [],
                    borderColor: '#ef4444'
                  }]
                }
              });
            }
 
            function updateDashboard(data) {
              if (!charts.system) createCharts();
 
              const timestamp = new Date().toLocaleTimeString();
              
              // Update system chart
              charts.system.data.labels.push(timestamp);
              charts.system.data.datasets[0].data.push(data.metrics.system.memory);
              charts.system.data.datasets[1].data.push(data.metrics.system.cpu);
              
              // Update requests chart
              charts.requests.data.labels.push(timestamp);
              charts.requests.data.datasets[0].data.push(data.metrics.requests.total);
              charts.requests.data.datasets[1].data.push(data.metrics.requests.errors);
              
              // Update rate limit chart
              charts.rateLimit.data.labels.push(timestamp);
              charts.rateLimit.data.datasets[0].data.push(data.metrics.rateLimit.blocked);
              charts.rateLimit.data.datasets[1].data.push(data.metrics.rateLimit.banned);
 
              // Keep last 50 points
              const maxPoints = 50;
              if (charts.system.data.labels.length > maxPoints) {
                charts.system.data.labels.shift();
                charts.system.data.datasets.forEach(d => d.data.shift());
                charts.requests.data.labels.shift();
                charts.requests.data.datasets.forEach(d => d.data.shift());
                charts.rateLimit.data.labels.shift();
                charts.rateLimit.data.datasets.forEach(d => d.data.shift());
              }
 
              // Update all charts
              Object.values(charts).forEach(chart => chart.update());
 
              // Update metrics
              document.querySelectorAll('.metric').forEach(metric => {
                const label = metric.children[0].textContent;
                let value = '';
                
                switch(label) {
                  case 'Memory Usage':
                    value = data.metrics.system.memory + '%';
                    break;
                  case 'CPU Usage':
                    value = data.metrics.system.cpu + '%';
                    break;
                  case 'Total Requests':
                    value = data.metrics.requests.total;
                    break;
                  case 'Error Rate':
                    value = data.metrics.requests.errors + '%';
                    break;
                  case 'Blocked Requests':
                    value = data.metrics.rateLimit.blocked;
                    break;
                  case 'Banned IPs':
                    value = data.metrics.rateLimit.banned;
                    break;
                }
                
                metric.children[1].textContent = value;
              });
 
              // Update alerts
              const alertsDiv = document.getElementById('alerts');
              alertsDiv.innerHTML = data.alerts
                .map(alert => '<div class="alert">' + alert.message + '</div>')
                .join('');
            }
 
            createCharts();
          </script>
        </body>
      </html>
    `;
  }
 
  collectMetrics(logger, rateLimiter, graphqlProfiler) {
    const metrics = {
      timestamp: Date.now(),
      system: {
        memory: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
        cpu: Math.round(process.cpuUsage().user / 1000000),
        uptime: process.uptime()
      }
    };
 
    if (logger) {
      metrics.requests = {
        total: logger.stats.requests || 0,
        errors: logger.stats.errors || 0,
        activeConnections: logger.stats.activeConnections || 0
      };
    }
 
    if (rateLimiter) {
      metrics.rateLimit = {
        blocked: rateLimiter.store?.requests?.size || 0,
        banned: rateLimiter.store?.bans?.size || 0
      };
    }
 
    this.addMetrics(metrics);
    const alerts = this.checkAlerts(metrics);
    this.broadcastMetrics(metrics, alerts);
 
    return metrics;
  }
 
  addMetrics(metrics) {
    // Update current metrics
    Object.entries(metrics).forEach(([category, data]) => {
      if (this.metrics[category]) {
        Object.assign(this.metrics[category], data);
      }
    });
 
    // Add to history
    this.metrics.history.metrics.push({
      timestamp: Date.now(),
      data: metrics
    });
 
    // Trim old data
    while (
      this.metrics.history.metrics.length > this.config.maxDataPoints ||
      Date.now() - this.metrics.history.metrics[0].timestamp > this.config.retentionPeriod
    ) {
      this.metrics.history.metrics.shift();
    }
  }
 
  checkAlerts(metrics) {
    const alerts = [];
 
    if (metrics.system.memory > this.config.alerts.maxMemoryUsage) {
      alerts.push({
        type: 'memory',
        level: 'warning',
        message: `High memory usage: ${metrics.system.memory}%`
      });
    }
 
    if (metrics.system.cpu > this.config.alerts.maxCpuUsage) {
      alerts.push({
        type: 'cpu',
        level: 'warning',
        message: `High CPU usage: ${metrics.system.cpu}%`
      });
    }
 
    if (metrics.requests?.errors > this.config.alerts.maxErrorRate) {
      alerts.push({
        type: 'errors',
        level: 'error',
        message: `High error rate: ${metrics.requests.errors}%`
      });
    }
 
    if (alerts.length && this.config.onAlert) {
      this.config.onAlert(alerts);
    }
 
    this.metrics.history.alerts.push({
      timestamp: Date.now(),
      alerts
    });
 
    return alerts;
  }
 
  broadcastMetrics(metrics, alerts) {
    if (!this.config.enableRealtime) return;
 
    const payload = JSON.stringify({
      type: 'update',
      metrics: {
        system: this.metrics.system,
        requests: this.metrics.requests,
        rateLimit: this.metrics.rateLimit
      },
      alerts
    });
 
    this.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(payload);
      }
    });
  }
 
  middleware(logger, rateLimiter, graphqlProfiler) {
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
    const since = Date.now() - this.parseTimeRange(timeRange);
    
    return {
      current: {
        system: this.metrics.system,
        requests: this.metrics.requests,
        rateLimit: this.metrics.rateLimit
      },
      history: {
        metrics: this.metrics.history.metrics.filter(m => m.timestamp >= since),
        alerts: this.metrics.history.alerts.filter(a => a.timestamp >= since)
      }
    };
  }
 
  parseTimeRange(range) {
    const units = {
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };
    const match = range.match(/^(\d+)([mhd])$/);
    if (!match) return 60 * 60 * 1000;
    return parseInt(match[1]) * units[match[2]];
  }
 }
 
 module.exports = MetricsDashboard;