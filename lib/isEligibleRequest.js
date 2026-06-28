const MULTIPART_CONTENT_TYPE = /^multipart\/[^;]+(?:\s*;.+)?$/i;
const BOUNDARY_PARAM = /(?:^|;)\s*boundary=(?:"[^"]+"|[^";\s]+)/i;
const UNACCEPTABLE_METHODS = ['GET', 'HEAD'];

const getHeaders = (req) => {
  if (req && typeof req.headers === 'object' && req.headers !== null) {
    return req.headers;
  }
  return {};
};

const asHeaderValues = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null) {
    return [];
  }
  return [value];
};

/**
 * Ensures the request contains a content body
 * @param  {Object}  req Express req object
 * @returns {Boolean}
 */
const hasBody = (req) => {
  const headers = getHeaders(req);
  const transferEncodings = asHeaderValues(headers['transfer-encoding']);
  const contentLengths = asHeaderValues(headers['content-length']);

  if (transferEncodings.some(value => typeof value === 'string' && value.trim() !== '')) {
    return true;
  }

  return contentLengths.some((value) => {
    if (typeof value === 'number') {
      return Number.isFinite(value) && value > 0;
    }
    if (typeof value === 'string') {
      const normalizedContentLength = value.trim();
      return normalizedContentLength !== '' && Number(normalizedContentLength) > 0;
    }
    return false;
  });
};

/**
 * Ensures the request is not using a non-compliant multipart method
 * such as GET or HEAD
 * @param  {Object}  req Express req object
 * @returns {Boolean}
 */
const hasAcceptableMethod = (req) => {
  const method = req && typeof req.method === 'string' ? req.method.toUpperCase() : '';
  return !UNACCEPTABLE_METHODS.includes(method);
};

/**
 * Ensures that only multipart requests are processed by express-fileupload
 * @param  {Object}  req Express req object
 * @returns {Boolean}
 */
const hasAcceptableContentType = (req) => {
  const headers = getHeaders(req);
  return asHeaderValues(headers['content-type']).some(contentType =>
    typeof contentType === 'string' &&
      MULTIPART_CONTENT_TYPE.test(contentType) &&
      BOUNDARY_PARAM.test(contentType)
  );
};

/**
 * Ensures that the request in question is eligible for file uploads
 * @param {Object} req Express req object
 * @returns {Boolean}
 */
module.exports = req => hasBody(req) && hasAcceptableMethod(req) && hasAcceptableContentType(req);
