/**
 * Update Password Controller
 * POST /api/admin/auth/update-password
 *
 * Update password via Supabase Admin API after OTP verification
 */

const Joi = require('joi');
const { db } = require('../../services/supabase');
const RedisLockService = require('../../services/redis');

const updatePasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
});

async function updatePassword(req, res) {
  let redis;

  try {
    const { error, value } = updatePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.details[0].message }
      });
    }

    const { email, password } = value;
    redis = new RedisLockService();

    // Verify OTP was validated
    const otpKey = `otp:${email}`;
    const otpDataStr = await redis.get(otpKey);

    if (!otpDataStr) {
      await redis.close();
      return res.status(400).json({
        success: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Session expired. Please start the password reset process again.'
        }
      });
    }

    const otpData = JSON.parse(otpDataStr);

    if (!otpData.verified) {
      await redis.close();
      return res.status(400).json({
        success: false,
        error: {
          code: 'CODE_NOT_VERIFIED',
          message: 'Please verify your code first.'
        }
      });
    }

    // Update password via Supabase Admin API


    // Find user by email
    const { data: users } = await db.auth.admin.listUsers();
    const user = users?.users?.find(u => u.email === email);

    if (!user) {
      await redis.close();
      return res.status(400).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found.' }
      });
    }

    // Update password
    const { error: updateError } = await db.auth.admin.updateUserById(
      user.id,
      { password: password }
    );

    if (updateError) {
      await redis.close();
      console.error('❌ Supabase password update error:', updateError.message);
      return res.status(500).json({
        success: false,
        error: { code: 'UPDATE_FAILED', message: 'Failed to update password.' }
      });
    }

    // Delete OTP from Redis (cleanup)
    await redis.del(otpKey);
    await redis.close();

    console.log(`✅ Password updated for ${email}`);

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully.'
    });

  } catch (error) {
    console.error('❌ Error in update-password:', error.message);
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

module.exports = { updatePassword };
