class GraphQLProfiler {
    constructor(config = {}) {
      this.config = {
        // Performance thresholds
        slowQueryThreshold: config.slowQueryThreshold || 1000,    // 1 second
        maxQueryComplexity: config.maxQueryComplexity || 100,
        maxDepth: config.maxDepth || 10,
        
        // Memory tracking
        trackMemory: config.trackMemory !== false,
        memoryThreshold: config.memoryThreshold || 100 * 1024 * 1024, // 100MB
        
        // Query tracking
        trackQueries: config.trackQueries !== false,
        maxTrackedQueries: config.maxTrackedQueries || 1000,
        
        // Field resolvers tracking
        trackResolvers: config.trackResolvers !== false,
        maxTrackedResolvers: config.maxTrackedResolvers || 1000,
        
        // Cache tracking
        trackCache: config.trackCache !== false,
        
        // Custom handlers
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
  
      complexity = countFields(query);
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
        const startTime = process.hrtime();
        const startMemory = process.memoryUsage();
  
        // Track the request
        const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const queryInfo = {
          query: req.body.query,
          variables: req.body.variables,
          startTime: Date.now(),
          complexity: this.calculateQueryComplexity(req.body.query)
        };
  
        // Check complexity
        if (queryInfo.complexity > this.config.maxQueryComplexity) {
          this.config.onHighComplexity?.(queryInfo);
          return res.status(400).json({
            error: 'Query too complex'
          });
        }
  
        // Track resolvers
        const resolverStats = new Map();
        const originalResolvers = {};
  
        if (this.config.trackResolvers) {
          // Wrap resolvers to track performance
          const wrapResolver = (resolver, path) => async (...args) => {
            const resolverStart = process.hrtime();
            const result = await resolver(...args);
            const [seconds, nanoseconds] = process.hrtime(resolverStart);
            const duration = seconds * 1000 + nanoseconds / 1000000;
  
            resolverStats.set(path, {
              duration,
              args: args.slice(0, -1),
              timestamp: Date.now()
            });
  
            return result;
          };
        }
  
        // Continue with request
        res.on('finish', () => {
          const [seconds, nanoseconds] = process.hrtime(startTime);
          const duration = seconds * 1000 + nanoseconds / 1000000;
          const endMemory = process.memoryUsage();
  
          // Calculate memory difference
          const memoryDiff = {
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal,
            external: endMemory.external - startMemory.external
          };
  
          // Store query stats
          if (this.config.trackQueries) {
            this.stats.queries.set(requestId, {
              ...queryInfo,
              duration,
              memoryDiff,
              statusCode: res.statusCode,
              resolvers: Array.from(resolverStats.entries())
            });
  
            // Cleanup old queries
            if (this.stats.queries.size > this.config.maxTrackedQueries) {
              const oldestKey = Array.from(this.stats.queries.keys())[0];
              this.stats.queries.delete(oldestKey);
            }
          }
  
          // Log if it's a slow query
          if (duration > this.config.slowQueryThreshold) {
            if (logger?.config.enabled.graphql) {
              logger.log('GRAPHQL', '🔍', 'Slow GraphQL Query', {
                QueryID: requestId,
                Duration: `${duration}ms`,
                Complexity: queryInfo.complexity,
                MemoryUsed: `${memoryDiff.heapUsed / 1024 / 1024}MB`,
                Query: queryInfo.query.substring(0, 200) + '...'
              });
            }
            this.config.onSlowQuery?.({ duration, query: queryInfo });
          }
        });
  
        next();
      };
    }
  
    getStats() {
      return {
        queries: {
          total: this.stats.queries.size,
          slow: Array.from(this.stats.queries.values())
            .filter(q => q.duration > this.config.slowQueryThreshold).length,
          avgDuration: Array.from(this.stats.queries.values())
            .reduce((acc, q) => acc + q.duration, 0) / this.stats.queries.size
        },
        resolvers: {
          total: this.stats.resolvers.size,
          avgDuration: Array.from(this.stats.resolvers.values())
            .reduce((acc, r) => acc + r.duration, 0) / this.stats.resolvers.size
        },
        memory: {
          current: process.memoryUsage(),
          peak: this.stats.memory.reduce((max, m) => 
            m.usage.heapUsed > max ? m.usage.heapUsed : max, 0
          )
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