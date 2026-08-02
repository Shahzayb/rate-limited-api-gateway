export interface RoutePatternMatch {
  pattern: string;
  specificity: number[];
  params: Record<string, string>;
}

export function parseRoutePattern(pattern: string): string[] {
  if (!pattern.startsWith('/')) {
    throw new Error(`Invalid route pattern: '${pattern}'. Must start with '/'.`);
  }
  const segments = pattern.split('/').filter(Boolean);
  if (segments.filter((s) => s === '*').length > 1) {
    throw new Error(`Invalid route pattern: '${pattern}'. Only one wildcard '*' is allowed.`);
  }
  if (segments.some((s, i) => s === '*' && i !== segments.length - 1)) {
    throw new Error(`Invalid route pattern: '${pattern}'. Wildcard '*' must be the last segment.`);
  }
  return segments;
}

export function matchRoutePattern(
  patternSegments: string[],
  path: string
): RoutePatternMatch | null {
  const pathSegments = path.split('/').filter(Boolean);
  const params: Record<string, string> = {};

  let patternIdx = 0;
  let pathIdx = 0;

  while (patternIdx < patternSegments.length && pathIdx < pathSegments.length) {
    const patternSegment = patternSegments[patternIdx];
    const pathSegment = pathSegments[pathIdx];

    if (!patternSegment || !pathSegment) {
      // Added check for undefined segments
      return null;
    }

    if (patternSegment.startsWith(':')) {
      params[patternSegment.substring(1)] = pathSegment;
      patternIdx++;
      pathIdx++;
    } else if (patternSegment === '*') {
      // Wildcard matches the rest of the path
      return {
        pattern: patternSegments.join('/'),
        specificity: calculateSpecificity(patternSegments),
        params,
      };
    } else if (patternSegment === pathSegment) {
      patternIdx++;
      pathIdx++;
    } else {
      return null; // Mismatch
    }
  }

  // If a wildcard is the last pattern segment, it matches if there are remaining path segments
  if (patternIdx === patternSegments.length - 1 && patternSegments[patternIdx] === '*') {
    return {
      pattern: patternSegments.join('/'),
      specificity: calculateSpecificity(patternSegments),
      params,
    };
  }

  // Exact match or no wildcard and all segments consumed
  if (patternIdx === patternSegments.length && pathIdx === pathSegments.length) {
    return {
      pattern: patternSegments.join('/'),
      specificity: calculateSpecificity(patternSegments),
      params,
    };
  }

  return null; // Mismatch in length or unmatched segments
}

export function calculateSpecificity(patternSegments: string[]): number[] {
  const SPECIFICITY_STATIC = 2;
  const SPECIFICITY_PARAM = 1;
  const SPECIFICITY_WILDCARD = 0;

  return patternSegments.map((segment) => {
    if (segment.startsWith(':')) {
      return SPECIFICITY_PARAM;
    } else if (segment === '*') {
      return SPECIFICITY_WILDCARD;
    } else {
      return SPECIFICITY_STATIC;
    }
  });
}

export function compareSpecificity(specA: number[], specB: number[]): number {
  const maxLength = Math.max(specA.length, specB.length);
  for (let i = 0; i < maxLength; i++) {
    const valA = specA[i] ?? -1;
    const valB = specB[i] ?? -1;

    if (valA > valB) return 1;
    if (valA < valB) return -1;
  }
  return 0;
}
