import { useRef, useEffect } from 'react'

/**
 * OTPInput - 6-digit code input with auto-focus
 *
 * Features:
 * - 6 individual input boxes
 * - Auto-focus next box on input
 * - Auto-focus previous box on backspace
 * - Paste support
 * - Only accepts numbers
 */
function OTPInput({ value = '', onChange, disabled = false, error = false }) {
  const inputRefs = useRef([])

  // Split value into array of 6 characters
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6)

  useEffect(() => {
    // Focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [])

  const handleChange = (index, e) => {
    const newValue = e.target.value

    // Only accept numbers
    if (newValue && !/^\d$/.test(newValue)) {
      return
    }

    // Build new OTP string
    const newDigits = [...digits]
    newDigits[index] = newValue
    const newOtp = newDigits.join('').slice(0, 6)

    onChange(newOtp)

    // Auto-focus next input
    if (newValue && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // If current is empty, go to previous
        inputRefs.current[index - 1]?.focus()
      }
    }

    // Handle arrow keys
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text')
    const pastedDigits = pastedData.replace(/\D/g, '').slice(0, 6)

    if (pastedDigits) {
      onChange(pastedDigits)
      // Focus appropriate input after paste
      const focusIndex = Math.min(pastedDigits.length, 5)
      inputRefs.current[focusIndex]?.focus()
    }
  }

  const handleFocus = (e) => {
    e.target.select()
  }

  return (
    <div className="flex justify-center gap-2 sm:gap-3">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={handleFocus}
          disabled={disabled}
          className={`
            w-10 h-12 sm:w-12 sm:h-14
            text-center text-xl sm:text-2xl font-bold
            border-2 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            transition-colors
            ${error
              ? 'border-red-500 bg-red-50 text-red-900'
              : 'border-gray-300 bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-white'
            }
          `}
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  )
}

export default OTPInput
