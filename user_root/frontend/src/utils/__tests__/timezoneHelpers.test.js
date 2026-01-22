import { getTimezoneLabel, formatTimezoneForDisplay } from '../timezoneHelpers';

describe('timezoneHelpers', () => {
  describe('getTimezoneLabel', () => {
    it('should return EST for Situational Judgment regardless of location', () => {
      expect(getTimezoneLabel('Situational Judgment', 'Vancouver')).toBe('EST');
      expect(getTimezoneLabel('Situational Judgment', 'Calgary')).toBe('EST');
      expect(getTimezoneLabel('Situational Judgment', 'Toronto')).toBe('EST');
      expect(getTimezoneLabel('Situational Judgment', 'Ottawa')).toBe('EST');
    });

    it('should return EST for Mini-mock regardless of location', () => {
      expect(getTimezoneLabel('Mini-mock', 'Vancouver')).toBe('EST');
      expect(getTimezoneLabel('Mini-mock', 'Calgary')).toBe('EST');
      expect(getTimezoneLabel('Mini-mock', 'Toronto')).toBe('EST');
    });

    it('should return PST for Clinical Skills in Vancouver', () => {
      expect(getTimezoneLabel('Clinical Skills', 'Vancouver')).toBe('PST');
      expect(getTimezoneLabel('Clinical Skills', 'vancouver')).toBe('PST');
      expect(getTimezoneLabel('Clinical Skills', 'VANCOUVER')).toBe('PST');
    });

    it('should return MST for Clinical Skills in Calgary', () => {
      expect(getTimezoneLabel('Clinical Skills', 'Calgary')).toBe('MST');
      expect(getTimezoneLabel('Clinical Skills', 'calgary')).toBe('MST');
      expect(getTimezoneLabel('Clinical Skills', 'CALGARY')).toBe('MST');
    });

    it('should return EST for Clinical Skills in other locations', () => {
      expect(getTimezoneLabel('Clinical Skills', 'Toronto')).toBe('EST');
      expect(getTimezoneLabel('Clinical Skills', 'Ottawa')).toBe('EST');
      expect(getTimezoneLabel('Clinical Skills', 'Montreal')).toBe('EST');
      expect(getTimezoneLabel('Clinical Skills', 'Halifax')).toBe('EST');
    });

    it('should return EST for Clinical Skills with missing location', () => {
      expect(getTimezoneLabel('Clinical Skills', null)).toBe('EST');
      expect(getTimezoneLabel('Clinical Skills', undefined)).toBe('EST');
      expect(getTimezoneLabel('Clinical Skills', '')).toBe('EST');
    });

    it('should return EST for unknown mock types', () => {
      expect(getTimezoneLabel('Unknown Type', 'Vancouver')).toBe('EST');
      expect(getTimezoneLabel('Mock Discussion', 'Calgary')).toBe('EST');
    });
  });

  describe('formatTimezoneForDisplay', () => {
    it('should format timezone with parentheses', () => {
      expect(formatTimezoneForDisplay('EST')).toBe('(EST)');
      expect(formatTimezoneForDisplay('PST')).toBe('(PST)');
      expect(formatTimezoneForDisplay('MST')).toBe('(MST)');
    });
  });
});
