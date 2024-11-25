const { defaultOptions } = require('./types');

function getRequestInfo(req, options = defaultOptions) {
  const info = {
    method: req.method,
    subdomains: req.subdomains,
    hostname: req.hostname,
    ip: req.ip,
    originalUrl: req.originalUrl,
    params: req.params,
    path: req.path,
    protocol: req.protocol,
    query: req.query,
    secure: req.secure,
    xhr: req.xhr,
    headers: req.headers,
    baseUrl: req.baseUrl
  };

  if (options.include) {
    return Object.fromEntries(
      Object.entries(info).filter(([key]) => 
        options.include.includes(key)
      )
    );
  }

  return info;
}

module.exports = getRequestInfo;