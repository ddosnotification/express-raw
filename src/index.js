module.exports = {
  getRequestInfo: require('./getRequestInfo'),
  detectDevTools: require('./detectDevTools'),
  expressLogger: require('./expressLogger'),
  RateLimiter: require('./rateLimiter'),
  WebSocketSupport: require('./websocketSupport'),
  GraphQLProfiler: require('./graphqlProfiler'),
  MetricsDashboard: require('./metricsDashboard')
};