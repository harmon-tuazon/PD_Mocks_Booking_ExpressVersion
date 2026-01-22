/**
 * POST /api/admin/auth/update-password
 *
 * Update password via Supabase Admin API after OTP verification
 */

const Joi = require('joi');
const RedisLockService = require('../../_shared/redis');
const { createClient } = require('@supabase/supabase-js');

const updatePasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
});

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Find user by email
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.users?.find(u => u.email === email);

    if (!user) {
      await redis.close();
      return res.status(400).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found.' }
      });
    }

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
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
};
