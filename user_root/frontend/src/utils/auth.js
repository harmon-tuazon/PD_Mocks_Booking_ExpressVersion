// Cookie-based authentication utilities

export const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

export const setCookie = (name, value, hours = 2) => {
  const expirationTime = new Date();
  expirationTime.setHours(expirationTime.getHours() + hours);

  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expirationTime.toUTCString()}; path=/; SameSite=Strict`;
};

export const removeCookie = (name) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
};

export const getUserSession = () => {
  try {
    const sessionCookie = getCookie('userSession');
    if (!sessionCookie) return null;

    const userData = JSON.parse(decodeURIComponent(sessionCookie));

    // Check if session is still valid (not older than 2 hours)
    const sessionAge = new Date().getTime() - userData.timestamp;
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

    if (sessionAge > maxAge) {
      // Remove expired cookie
      removeCookie('userSession');
      return null;
    }

    return userData.authenticated ? userData : null;
  } catch (error) {
    console.error('Error parsing user session:', error);
    // Remove invalid cookie
    removeCookie('userSession');
    return null;
  }
};

export const setUserSession = (userData) => {
  const sessionData = {
    ...userData,
    authenticated: true,
    timestamp: new Date().getTime()
  };

  setCookie('userSession', JSON.stringify(sessionData), 2);
};

export const clearUserSession = () => {
  removeCookie('userSession');
};