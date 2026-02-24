/**
 * Express middleware factory for Joi schema validation
 * @param {object} schema - Joi schema to validate req.body against
 * @returns {function} Express middleware
 */
const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
          details: error.details.map(d => ({
            field: d.path.join('.'),
            message: d.message
          }))
        }
      });
    }

    req.body = value;
    next();
  };
};

module.exports = { validateBody };
