/// <reference types="vitest/globals" />
import {
  parseRoutePattern,
  matchRoutePattern,
  calculateSpecificity,
  compareSpecificity,
} from './routePattern.js';

describe('parseRoutePattern', () => {
  it('should parse a simple static pattern', () => {
    expect(parseRoutePattern('/users')).toEqual(['users']);
  });

  it('should parse a pattern with a parameter', () => {
    expect(parseRoutePattern('/users/:id')).toEqual(['users', ':id']);
  });

  it('should parse a pattern with a wildcard', () => {
    expect(parseRoutePattern('/api/v1/*')).toEqual(['api', 'v1', '*']);
  });

  it('should parse a complex pattern', () => {
    expect(parseRoutePattern('/orgs/:orgId/repos/*')).toEqual(['orgs', ':orgId', 'repos', '*']);
  });

  it('should throw error for pattern not starting with /', () => {
    expect(() => parseRoutePattern('users')).toThrow(
      `Invalid route pattern: 'users'. Must start with '/'.`
    );
  });

  it('should throw error for wildcard not at the end', () => {
    expect(() => parseRoutePattern('/api/*/v1')).toThrow(
      `Invalid route pattern: '/api/*/v1'. Wildcard '*' must be the last segment.`
    );
  });

  it('should throw error for multiple wildcards', () => {
    expect(() => parseRoutePattern('/api/*/*')).toThrow(
      `Invalid route pattern: '/api/*/*'. Only one wildcard '*' is allowed.`
    );
  });

  it('should parse a wildcard after a parameter segment', () => {
    expect(parseRoutePattern('/users/:id/*')).toEqual(['users', ':id', '*']);
  });
});

describe('matchRoutePattern', () => {
  it('should match a static path exactly', () => {
    const patternSegments = parseRoutePattern('/users');
    const match = matchRoutePattern(patternSegments, '/users');
    expect(match).not.toBeNull();
    expect(match?.params).toEqual({});
  });

  it('should not match a static path with extra segments', () => {
    const patternSegments = parseRoutePattern('/users');
    const match = matchRoutePattern(patternSegments, '/users/123');
    expect(match).toBeNull();
  });

  it('should match a path with a parameter', () => {
    const patternSegments = parseRoutePattern('/users/:id');
    const match = matchRoutePattern(patternSegments, '/users/123');
    expect(match).not.toBeNull();
    expect(match?.params).toEqual({ id: '123' });
  });

  it('should not match a path with a parameter if static part mismatches', () => {
    const patternSegments = parseRoutePattern('/users/:id');
    const match = matchRoutePattern(patternSegments, '/posts/123');
    expect(match).toBeNull();
  });

  it('should match a path with a wildcard', () => {
    const patternSegments = parseRoutePattern('/api/v1/*');
    const match = matchRoutePattern(patternSegments, '/api/v1/resource/123');
    expect(match).not.toBeNull();
    expect(match?.params).toEqual({});
  });

  it('should match a path with a wildcard and parameters', () => {
    const patternSegments = parseRoutePattern('/orgs/:orgId/repos/*');
    const match = matchRoutePattern(patternSegments, '/orgs/google/repos/search');
    expect(match).not.toBeNull();
    expect(match?.params).toEqual({ orgId: 'google' });
  });

  it('should not match if static segment mismatches before wildcard', () => {
    const patternSegments = parseRoutePattern('/api/v1/*');
    const match = matchRoutePattern(patternSegments, '/api/v2/resource');
    expect(match).toBeNull();
  });

  it('should match root wildcard', () => {
    const patternSegments = parseRoutePattern('/*');
    const match = matchRoutePattern(patternSegments, '/any/path/here');
    expect(match).not.toBeNull();
    expect(match?.params).toEqual({});
  });

  it('should not match empty path with non-wildcard pattern', () => {
    const patternSegments = parseRoutePattern('/users');
    const match = matchRoutePattern(patternSegments, '/');
    expect(match).toBeNull();
  });

  it('should match empty path with root wildcard', () => {
    const patternSegments = parseRoutePattern('/*');
    const match = matchRoutePattern(patternSegments, '/');
    expect(match).not.toBeNull();
  });
});

describe('calculateSpecificity', () => {
  it('should calculate specificity for a static pattern', () => {
    expect(calculateSpecificity(parseRoutePattern('/users'))).toEqual([2]);
  });

  it('should calculate specificity for a pattern with a parameter', () => {
    expect(calculateSpecificity(parseRoutePattern('/users/:id'))).toEqual([2, 1]);
  });

  it('should calculate specificity for a pattern with a wildcard', () => {
    expect(calculateSpecificity(parseRoutePattern('/api/v1/*'))).toEqual([2, 2, 0]);
  });

  it('should calculate specificity for a complex pattern', () => {
    expect(calculateSpecificity(parseRoutePattern('/orgs/:orgId/repos/*'))).toEqual([2, 1, 2, 0]);
  });

  it('should handle empty segments correctly', () => {
    expect(calculateSpecificity(parseRoutePattern('/'))).toEqual([]);
  });
});

describe('compareSpecificity', () => {
  it('should return 0 for equal specificity', () => {
    expect(compareSpecificity([2, 1, 0], [2, 1, 0])).toBe(0);
  });

  it('should return 1 if specA is more specific (earlier static segment)', () => {
    expect(compareSpecificity([2, 2, 0], [2, 1, 0])).toBe(1);
  });

  it('should return -1 if specB is more specific (earlier static segment)', () => {
    expect(compareSpecificity([2, 1, 0], [2, 2, 0])).toBe(-1);
  });

  it('should return 1 if specA is longer and more specific', () => {
    expect(compareSpecificity([2, 2, 2], [2, 2, 0])).toBe(1);
  });

  it('should return -1 if specB is longer and more specific', () => {
    expect(compareSpecificity([2, 2, 0], [2, 2, 2])).toBe(-1);
  });

  it('should handle different lengths correctly (shorter is less specific)', () => {
    expect(compareSpecificity([2, 2], [2, 2, 0])).toBe(-1);
    expect(compareSpecificity([2, 2, 0], [2, 2])).toBe(1);
  });

  it('should handle empty specificity arrays', () => {
    expect(compareSpecificity([], [])).toBe(0);
    expect(compareSpecificity([2], [])).toBe(1);
    expect(compareSpecificity([], [2])).toBe(-1);
  });
});
