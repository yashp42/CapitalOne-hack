/**
 * CORS Debug Middleware
 * 
 * This middleware logs detailed information about CORS-related headers and requests
 * It helps debug issues with CORS in production environments
 */

export const corsDebug = (req, res, next) => {
  // Log basic request information
  console.log('-------- CORS DEBUG --------');
  console.log(`${req.method} ${req.url}`);
  console.log(`Origin: ${req.headers.origin || 'No Origin header'}`);
  
  // Log all request headers that might be relevant to CORS
  const corsRelevantHeaders = [
    'origin', 
    'access-control-request-method',
    'access-control-request-headers',
    'referer',
    'user-agent',
    'host',
    'x-forwarded-host',
    'x-forwarded-proto',
    'cookie'
  ];
  
  console.log('Request Headers:');
  corsRelevantHeaders.forEach(header => {
    if (req.headers[header]) {
      if (header === 'cookie') {
        console.log(` - ${header}: [REDACTED - Cookie Present]`);
      } else {
        console.log(` - ${header}: ${req.headers[header]}`);
      }
    }
  });
  
  // Track CORS headers in the response
  const originalSetHeader = res.setHeader;
  res.setHeader = function(name, value) {
    if (name.toLowerCase().startsWith('access-control')) {
      console.log(`Setting CORS header: ${name}: ${value}`);
    }
    return originalSetHeader.apply(this, arguments);
  };
  
  // Capture response after it's sent
  const originalEnd = res.end;
  res.end = function() {
    console.log('Response Status:', res.statusCode);
    console.log('Response CORS Headers:');
    
    [
      'access-control-allow-origin',
      'access-control-allow-methods',
      'access-control-allow-headers',
      'access-control-allow-credentials',
      'access-control-max-age',
      'access-control-expose-headers',
      'vary'
    ].forEach(header => {
      const value = res.getHeader(header);
      if (value) {
        console.log(` - ${header}: ${value}`);
      }
    });
    
    console.log('-------- END CORS DEBUG --------');
    return originalEnd.apply(this, arguments);
  };
  
  next();
};

export default corsDebug;
