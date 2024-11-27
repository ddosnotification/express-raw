class GraphQLProfiler {
  constructor(config = {}) {
    this.config = {
      slowQueryThreshold: config.slowQueryThreshold || 1000,
      maxQueryComplexity: config.maxQueryComplexity || 100,
      maxDepth: config.maxDepth || 10,
      trackMemory: config.trackMemory !== false,
      memoryThreshold: config.memoryThreshold || 100 * 1024 * 1024,
      trackQueries: config.trackQueries !== false,
      maxTrackedQueries: config.maxTrackedQueries || 1000,
      trackResolvers: config.trackResolvers !== false,
      maxTrackedResolvers: config.maxTrackedResolvers || 1000,
      trackCache: config.trackCache !== false,
      onSlowQuery: config.onSlowQuery || null,
      onHighComplexity: config.onHighComplexity || null,
      onMemoryThreshold: config.onMemoryThreshold || null
    };
 
    this.stats = {
      queries: new Map(),
      resolvers: new Map(),
      cache: new Map(),
      memory: [],
      startTime: Date.now()
    };
  }
 
  calculateQueryComplexity(query) {
    if (!query) return 0;
    
    let complexity = 0;
    let depth = 0;
 
    const countFields = (obj) => {
      if (typeof obj !== 'object' || !obj) return 0;
      
      depth++;
      if (depth > this.config.maxDepth) {
        throw new Error('Query depth exceeds maximum allowed depth');
      }
 
      let count = 0;
      for (const key in obj) {
        count++;
        if (typeof obj[key] === 'object') {
          count += countFields(obj[key]);
        }
      }
      depth--;
      return count;
    };
 
    try {
      complexity = countFields(query);
    } catch(e) {
      complexity = 0;
    }
    
    return complexity;
  }
 
  trackMemoryUsage() {
    if (!this.config.trackMemory) return;
 
    const memoryUsage = process.memoryUsage();
    this.stats.memory.push({
      timestamp: Date.now(),
      usage: memoryUsage
    });
 
    if (memoryUsage.heapUsed > this.config.memoryThreshold) {
      this.config.onMemoryThreshold?.(memoryUsage);
    }
  }
 
  middleware(logger) {
    return async (req, res, next) => {
      if (!req.body) {
        return res.status(400).json({ error: 'No request body' });
      }
 
      if (!req.body.query) {
        return res.status(400).json({ error: 'No GraphQL query found' });
      }
 
      const startTime = process.hrtime();
      const startMemory = process.memoryUsage();
      const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);
 
      try {
        const queryInfo = {
          query: req.body.query,
          variables: req.body.variables || {},
          startTime: Date.now()
        };
 
        queryInfo.complexity = this.calculateQueryComplexity(queryInfo.query);
 
        if (queryInfo.complexity > this.config.maxQueryComplexity) {
          if (this.config.onHighComplexity) {
            this.config.onHighComplexity(queryInfo);
          }
          return res.status(400).json({
            error: 'Query too complex',
            complexity: queryInfo.complexity,
            maxAllowed: this.config.maxQueryComplexity
          });
        }
 
        const resolverStats = new Map();
 
        res.on('finish', () => {
          const [seconds, nanoseconds] = process.hrtime(startTime);
          const duration = seconds * 1000 + nanoseconds / 1000000;
          const endMemory = process.memoryUsage();
 
          const memoryDiff = {
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal,
            external: endMemory.external - startMemory.external
          };
 
          if (this.config.trackQueries) {
            this.stats.queries.set(requestId, {
              ...queryInfo,
              duration,
              memoryDiff,
              statusCode: res.statusCode,
              resolvers: Array.from(resolverStats.entries())
            });
 
            if (this.stats.queries.size > this.config.maxTrackedQueries) {
              const oldestKey = Array.from(this.stats.queries.keys())[0];
              this.stats.queries.delete(oldestKey);
            }
          }
 
          if (duration > this.config.slowQueryThreshold) {
            if (logger?.config.enabled.graphql) {
              logger.log('GRAPHQL', '🔍', 'Slow GraphQL Query', {
                QueryID: requestId,
                Duration: `${duration}ms`,
                Complexity: queryInfo.complexity,
                MemoryUsed: `${Math.round(memoryDiff.heapUsed / 1024 / 1024)}MB`,
                Query: queryInfo.query.substring(0, 200) + (queryInfo.query.length > 200 ? '...' : '')
              });
            }
            
            if (this.config.onSlowQuery) {
              this.config.onSlowQuery({ 
                duration, 
                query: queryInfo,
                memoryUsage: memoryDiff
              });
            }
          }
 
          this.trackMemoryUsage();
        });
 
        next();
      } catch (error) {
        if (logger?.config.enabled.graphql) {
          logger.log('GRAPHQL', '❌', 'GraphQL Error', {
            Error: error.message,
            Query: req.body.query
          });
        }
        
        return res.status(400).json({
          error: error.message
        });
      }
    };
  }
 
  getStats() {
    const queries = Array.from(this.stats.queries.values());
    const resolvers = Array.from(this.stats.resolvers.values());
 
    return {
      queries: {
        total: this.stats.queries.size,
        slow: queries.filter(q => q.duration > this.config.slowQueryThreshold).length,
        avgDuration: queries.length ? queries.reduce((acc, q) => acc + q.duration, 0) / queries.length : 0,
        maxDuration: queries.length ? Math.max(...queries.map(q => q.duration)) : 0
      },
      resolvers: {
        total: this.stats.resolvers.size,
        avgDuration: resolvers.length ? resolvers.reduce((acc, r) => acc + r.duration, 0) / resolvers.length : 0
      },
      memory: {
        current: process.memoryUsage(),
        peak: this.stats.memory.length ? 
          Math.max(...this.stats.memory.map(m => m.usage.heapUsed)) : 0,
        average: this.stats.memory.length ?
          this.stats.memory.reduce((acc, m) => acc + m.usage.heapUsed, 0) / this.stats.memory.length : 0
      },
      uptime: Date.now() - this.stats.startTime
    };
  }
 
  reset() {
    this.stats.queries.clear();
    this.stats.resolvers.clear();
    this.stats.cache.clear();
    this.stats.memory = [];
    this.stats.startTime = Date.now();
  }
 }
 
 module.exports = GraphQLProfiler;