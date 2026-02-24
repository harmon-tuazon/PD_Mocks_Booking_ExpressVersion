/**
 * Verify OTP Controller
 * POST /api/admin/auth/verify-otp
 *
 * Verify OTP code against Redis
 */

const Joi = require('joi');
const RedisLockService = require('../../services/redis');

const verifyOtpSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).pattern(/^\d+$/).required()
});

async function verifyOtp(req, res) {
  let redis;

  try {
    const { error, value } = verifyOtpSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.details[0].message }
      });
    }

    const { email, code } = value;
    redis = new RedisLockService();

    // Get OTP data from Redis
    const otpKey = `otp:${email}`;
    const otpDataStr = await redis.get(otpKey);

    if (!otpDataStr) {
      await redis.close();
      return res.status(400).json({
        success: false,
        error: {
          code: 'CODE_EXPIRED',
          message: 'This code has expired. Please request a new one.'
        }
      });
    }

    const otpData = JSON.parse(otpDataStr);

    // Verify code
    if (otpData.code !== code) {
      await redis.close();
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CODE',
          message: 'Invalid code. Please check and try again.'
        }
      });
    }

    // Code is valid - mark as verified (don't delete yet, need for password update)
    otpData.verified = true;
    await redis.setex(otpKey, 1800, JSON.stringify(otpData));
    await redis.close();

    return res.status(200).json({
      success: true,
      message: 'Code verified successfully.'
    });

  } catch (error) {
    console.error('❌ Error in verify-otp:', error.message);
    if (redis) {
      try {
        await redis.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred. Please try again.' }
    });
  }
}

module.exports = { verifyOtp };
