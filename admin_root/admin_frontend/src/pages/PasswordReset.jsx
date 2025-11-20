import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ResponsiveLogo } from '../components/shared/Logo'
import OTPInput from '../components/shared/OTPInput'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, ArrowLeft, CheckCircle, XCircle } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || ''

function PasswordReset() {
  const [step, setStep] = useState('email') // 'email' | 'verify' | 'update'
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)

  const navigate = useNavigate()
  const { user } = useAuth()

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCountdown])

  // Password validation
  const passwordChecks = {
    length: newPassword.length >= 8,
    hasLetter: /[a-zA-Z]/.test(newPassword),
    hasNumber: /\d/.test(newPassword),
    matches: newPassword === confirmPassword && newPassword.length > 0
  }

  const isPasswordValid = passwordChecks.length && passwordChecks.hasLetter && passwordChecks.hasNumber && passwordChecks.matches

  // Password strength
  const getPasswordStrength = () => {
    let strength = 0
    if (passwordChecks.length) strength++
    if (passwordChecks.hasLetter) strength++
    if (passwordChecks.hasNumber) strength++
    if (newPassword.length >= 12) strength++
    if (/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) strength++

    if (strength <= 2) return { label: 'Weak', color: 'bg-red-500', width: '33%' }
    if (strength <= 3) return { label: 'Medium', color: 'bg-yellow-500', width: '66%' }
    return { label: 'Strong', color: 'bg-green-500', width: '100%' }
  }

  const passwordStrength = getPasswordStrength()

  // Step 1: Request OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE}/api/admin/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (response.status === 429) {
        setError(data.error?.message || 'Please wait before requesting a new code.')
      } else if (data.success) {
        setStep('verify')
        setResendCountdown(60)
      } else {
        setError(data.error?.message || 'Failed to send code.')
      }
    } catch (err) {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE}/api/admin/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode })
      })

      const data = await response.json()

      if (data.success) {
        setStep('update')
      } else {
        setError(data.error?.message || 'Invalid code.')
      }
    } catch (err) {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  // Step 3: Update Password
  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    setError('')

    if (!isPasswordValid) {
      setError('Please meet all password requirements.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${API_BASE}/api/admin/auth/update-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: newPassword })
      })

      const data = await response.json()

      if (data.success) {
        // Redirect to login with success message
        navigate('/login', { state: { message: 'Password updated successfully. Please sign in.' } })
      } else {
        setError(data.error?.message || 'Failed to update password.')
      }
    } catch (err) {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  // Resend OTP
  const handleResend = async () => {
    if (resendCountdown > 0) return

    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE}/api/admin/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (data.success) {
        setResendCountdown(60)
        setOtpCode('')
      } else {
        setError(data.error?.message || 'Failed to resend code.')
      }
    } catch (err) {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* PrepDoctors Logo */}
        <div className="flex justify-center mb-6">
          <ResponsiveLogo size="large" />
        </div>

        <h2 className="mt-6 text-center text-3xl font-extrabold text-navy-900">
          Reset Your Password
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {step === 'email' && 'Enter your email to receive a verification code'}
          {step === 'verify' && `We sent a code to ${email}`}
          {step === 'update' && 'Create a new password'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Step 1: Email Input */}
          {step === 'email' && (
            <form onSubmit={handleRequestOtp} className="space-y-6">
              <div>
                <Label htmlFor="email">Email address</Label>
                <div className="mt-1">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@prepdoctors.com"
                  />
                </div>
              </div>

              <div>
                <Button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full"
                >
                  {loading ? 'Sending...' : 'Send Code'}
                </Button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-sm font-medium text-primary-600 hover:text-primary-500"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* Step 2: OTP Verification */}
          {step === 'verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div>
                <Label className="block text-center mb-4">Enter verification code</Label>
                <OTPInput
                  value={otpCode}
                  onChange={setOtpCode}
                  disabled={loading}
                  error={!!error}
                />
              </div>

              <div className="text-center text-sm text-gray-600">
                {resendCountdown > 0 ? (
                  <span>Resend code in {resendCountdown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading}
                    className="font-medium text-primary-600 hover:text-primary-500"
                  >
                    Resend Code
                  </button>
                )}
              </div>

              <div>
                <Button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full"
                >
                  {loading ? 'Verifying...' : 'Verify Code'}
                </Button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setStep('email')
                    setOtpCode('')
                    setError('')
                  }}
                  className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-500"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Set New Password */}
          {step === 'update' && (
            <form onSubmit={handleUpdatePassword} className="space-y-6">
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <div className="mt-1 relative">
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>

                {/* Password strength indicator */}
                {newPassword && (
                  <div className="mt-2">
                    <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${passwordStrength.color} transition-all duration-300`}
                        style={{ width: passwordStrength.width }}
                      />
                    </div>
                    <p className="text-xs mt-1 text-gray-600">{passwordStrength.label}</p>
                  </div>
                )}
              </div>

              {/* Password requirements */}
              <div className="space-y-1 text-sm">
                <div className={`flex items-center ${passwordChecks.length ? 'text-green-600' : 'text-gray-500'}`}>
                  {passwordChecks.length ? <CheckCircle className="w-4 h-4 mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                  At least 8 characters
                </div>
                <div className={`flex items-center ${passwordChecks.hasLetter ? 'text-green-600' : 'text-gray-500'}`}>
                  {passwordChecks.hasLetter ? <CheckCircle className="w-4 h-4 mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                  Include letters
                </div>
                <div className={`flex items-center ${passwordChecks.hasNumber ? 'text-green-600' : 'text-gray-500'}`}>
                  {passwordChecks.hasNumber ? <CheckCircle className="w-4 h-4 mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                  Include numbers
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="mt-1 relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {confirmPassword && (
                  <div className={`flex items-center mt-1 text-sm ${passwordChecks.matches ? 'text-green-600' : 'text-red-500'}`}>
                    {passwordChecks.matches ? <CheckCircle className="w-4 h-4 mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                    Passwords {passwordChecks.matches ? 'match' : 'do not match'}
                  </div>
                )}
              </div>

              <div>
                <Button
                  type="submit"
                  disabled={loading || !isPasswordValid}
                  className="w-full"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default PasswordReset
