/**
 * Enterprise XSS Input Sanitization Middleware
 * Recursively inspects req.body, req.query, and req.params, stripping HTML tags
 * and dangerous script tags to eliminate Cross-Site Scripting (XSS) opportunities.
 */
function cleanText(val) {
  if (typeof val !== 'string') return val;
  // Strip script tags and general HTML elements to prevent HTML injections/XSS
  return val
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      } else {
        obj[key] = cleanText(obj[key]);
      }
    }
  }
  return obj;
}

const sanitizeInput = (req, res, next) => {
  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  next();
};

module.exports = { sanitizeInput };
