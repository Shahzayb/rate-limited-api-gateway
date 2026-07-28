import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

// Custom metric to count HTTP 200 responses
const successfulRequests = new Counter('successful_200_requests');
const rateLimitedRequests = new Counter('rate_limited_429_requests');

export const options = {
  // Use per-vu-iterations to force all VUs to fire exactly once as fast as possible simultaneously
  scenarios: {
    concurrency_burst: {
      executor: 'per-vu-iterations',
      vus: 30, // 30 VUs hitting at the exact same time
      iterations: 1, // 1 request per VU (30 total concurrent requests)
      maxDuration: '10s',
    },
  },
  thresholds: {
    // RACE CONDITION TEST:
    // If rate limiter works: EXACTLY 10 requests succeed.
    // If race condition exists: MORE THAN 10 requests succeed (> 10).
    successful_200_requests: ['count<=10'],
  },
};

export default function () {
  // const url = 'http://node_server:3000/api/v1';
  const url = 'http://node_server:3000/admin';
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'test_key',
    },
  };

  const res = http.get(url, params);

  if (res.status === 200) {
    successfulRequests.add(1);
  } else if (res.status === 429) {
    rateLimitedRequests.add(1);
  }

  check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
  });
}
