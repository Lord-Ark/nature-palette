const MULTIPART_CONTENT_TYPE = /^multipart\/[^;]+(?:\s*;.+)?$/i;
const BOUNDARY_PARAM = /(?:^|;)\s*boundary=(?:"[^"]+"|[^";\s]+)/i;
const UNACCEPTABLE_METHODS = ['GET', 'HEAD'];

/**
 * Ensures the request contains a content body
 * @param  {Object}  req Express req object
 * @returns {Boolean}
 */
const hasBody = (req) => {
  const transferEncoding = req.headers['transfer-encoding'];
  const contentLength = req.headers['content-length'];

  if (typeof transferEncoding === 'string' && transferEncoding.trim() !== '') {
    return true;
  }

  if (typeof contentLength === 'number') {
    return Number.isFinite(contentLength) && contentLength > 0;
  }

  if (typeof contentLength === 'string') {
    const normalizedContentLength = contentLength.trim();
    return normalizedContentLength !== '' && Number(normalizedContentLength) > 0;
  }

  return false;
};

/**
 * Ensures the request is not using a non-compliant multipart method
 * such as GET or HEAD
 * @param  {Object}  req Express req object
 * @returns {Boolean}
 */
const hasAcceptableMethod = (req) => {
  const method = typeof req.method === 'string' ? req.method.toUpperCase() : '';
  return !UNACCEPTABLE_METHODS.includes(method);
};

/**
 * Ensures that only multipart requests are processed by express-fileupload
 * @param  {Object}  req Express req object
 * @returns {Boolean}
 */
const hasAcceptableContentType = (req) => {
  const contentType = req.headers['content-type'];
  return typeof contentType === 'string' &&
    MULTIPART_CONTENT_TYPE.test(contentType) &&
    BOUNDARY_PARAM.test(contentType);
};

/**
 * Ensures that the request in question is eligible for file uploads
 * @param {Object} req Express req object
 * @returns {Boolean}
 */
module.exports = req => hasBody(req) && hasAcceptableMethod(req) && hasAcceptableContentType(req);
