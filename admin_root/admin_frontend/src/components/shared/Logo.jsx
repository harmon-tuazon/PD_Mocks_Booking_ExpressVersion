import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * PrepDoctors Logo Component
 *
 * A flexible logo component that now uses a single logo across all contexts.
 * The 'variant' prop is maintained for backward compatibility but all variants
 * now use the same logo image.
 *
 * Security: Uses React state for image error handling instead of innerHTML
 * to prevent XSS vulnerabilities.
 *
 * @param {Object} props
 * @param {'full'|'horizontal'|'icon'} props.variant - Logo variant (maintained for compatibility)
 * @param {'small'|'medium'|'large'|'xl'} props.size - Size of the logo
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.linkToHome - Whether to wrap logo in a link to home
 * @param {function} props.onClick - Optional click handler
 * @param {boolean} props.priority - Whether to load image with high priority
 */
const Logo = ({
  variant = 'full',
  size = 'medium',
  className = '',
  linkToHome = false,
  onClick,
  priority = false,
  ...props
}) => {
  // State to track if image failed to load
  const [imageError, setImageError] = useState(false);

  // Single logo URL from HubSpot CDN - used for all variants
  const logoUrl = 'https://46814382.fs1.hubspotusercontent-na1.net/hubfs/46814382/logo%20dark%20blue.png';

  // Size configurations - consistent across all variants
  const sizeClasses = {
    small: 'h-8 w-auto',
    medium: 'h-12 w-auto',
    large: 'h-16 w-auto',
    xl: 'h-20 w-auto'
  };

  // Text size configurations for fallback
  const textSizeClasses = {
    small: 'text-lg',
    medium: 'text-xl',
    large: 'text-2xl',
    xl: 'text-3xl'
  };

  // Alt text
  const logoAlt = 'PrepDoctors - Medical Education Excellence';

  // Get the appropriate size class
  const logoSizeClass = sizeClasses[size];
  const textSizeClass = textSizeClasses[size];

  // Base image classes
  const baseClasses = `
    ${logoSizeClass}
    object-contain
    transition-opacity duration-200
    ${onClick ? 'cursor-pointer hover:opacity-80' : ''}
    ${className}
  `.trim();

  // Loading strategy
  const loadingStrategy = priority ? 'eager' : 'lazy';

  // Logo image element or text fallback
  const logoElement = imageError ? (
    // Text fallback - rendered via React, not innerHTML (prevents XSS)
    <div className={`text-primary-600 font-headline font-bold ${textSizeClass}`}>
      PrepDoctors
    </div>
  ) : (
    <img
      src={logoUrl}
      alt={logoAlt}
      className={baseClasses}
      loading={loadingStrategy}
      onClick={onClick}
      onError={() => {
        // Securely set error state instead of manipulating DOM
        setImageError(true);
      }}
      {...props}
    />
  );

  // Wrap in link if requested
  if (linkToHome) {
    return (
      <a
        href="/"
        className="inline-block focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 rounded"
        aria-label="PrepDoctors Home"
      >
        {logoElement}
      </a>
    );
  }

  return logoElement;
};

/**
 * Responsive Logo Component
 *
 * Displays the logo with responsive sizing.
 * Since we now use a single logo, this component maintains consistent
 * display across all screen sizes with the same image.
 */
export const ResponsiveLogo = ({ size = 'medium', className = '', ...props }) => {
  return (
    <div className={`flex items-center ${className}`}>
      <Logo size={size} {...props} />
    </div>
  );
};

/**
 * Logo with Text Fallback
 *
 * Shows PrepDoctors text if the image fails to load
 * Security: Now uses the main Logo component which handles fallback via React state
 */
export const LogoWithFallback = ({ size = 'medium', className = '', ...props }) => {
  return (
    <div className={`flex items-center ${className}`}>
      <Logo size={size} {...props} />
    </div>
  );
};

// PropTypes
Logo.propTypes = {
  variant: PropTypes.oneOf(['full', 'horizontal', 'icon']),
  size: PropTypes.oneOf(['small', 'medium', 'large', 'xl']),
  className: PropTypes.string,
  linkToHome: PropTypes.bool,
  onClick: PropTypes.func,
  priority: PropTypes.bool
};

ResponsiveLogo.propTypes = {
  size: PropTypes.oneOf(['small', 'medium', 'large', 'xl']),
  className: PropTypes.string
};

LogoWithFallback.propTypes = {
  size: PropTypes.oneOf(['small', 'medium', 'large', 'xl']),
  className: PropTypes.string
};

export default Logo;
