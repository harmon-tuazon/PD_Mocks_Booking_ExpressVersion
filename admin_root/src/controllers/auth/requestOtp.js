/**
 * Request OTP Controller
 * POST /api/admin/auth/request-otp
 *
 * Generate OTP, store in Redis, trigger HubSpot email workflow
 */

const Joi = require('joi');
const { supabaseAdmin } = require('../../services/supabase');
const RedisLockService = require('../../services/redis');
const axios = require('axios');

// Validation schema
const requestOtpSchema = Joi.object({
  email: Joi.string().email().required()
});

async function requestOtp(req, res) {
  let redis;

  try {
    // Validate input
    const { error, value } = requestOtpSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.details[0].message }
      });
    }

    const { email } = value;
    redis = new RedisLockService();

    // Check rate limit
    const rateLimitKey = `otp:ratelimit:${email}`;
    const isRateLimited = await redis.get(rateLimitKey);

    if (isRateLimited) {
      await redis.close();
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Please wait 60 seconds before requesting a new code.'
        }
      });
    }

    // Check if user exists in Supabase


    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = users?.users?.some(u => u.email === email);

    if (userExists) {
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Store in Redis with 30-minute TTL
      const otpData = {
        code: otp,
        createdAt: Date.now()
      };

      await redis.setex(`otp:${email}`, 1800, JSON.stringify(otpData));

      // Set rate limit (60 seconds)
      await redis.setex(rateLimitKey, 60, '1');

      // Trigger HubSpot workflow via webhook
      const hubspotWebhookUrl = 'https://api-na1.hubapi.com/automation/v4/webhook-triggers/46814382/GC6xV7M';

      try {
        await axios.post(hubspotWebhookUrl, {
          email: email,
          otp: otp
        });
        console.log(`✅ OTP sent to ${email}`);
      } catch (webhookError) {
        // Log error but don't reveal to user
        console.error('❌ HubSpot webhook error:', webhookError.message);
      }
    }

    await redis.close();

    // Always return success (security - don't reveal if email exists)
    return res.status(200).json({
      success: true,
      message: 'If this email exists, a code has been sent.'
    });

  } catch (error) {
    console.error('❌ Error in request-otp:', error.message);
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

module.exports = { requestOtp };
