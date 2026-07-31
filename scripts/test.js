import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const successfulRequests = new Counter('successful_200_requests');
const rateLimitedRequests = new Counter('rate_limited_429_requests');

const maxRequests = 2;
const windowSeconds = 30;

export const options = {
  scenarios: {
    concurrency_burst: {
      executor: 'per-vu-iterations',
      vus: 30,
      iterations: 1,
      maxDuration: `${windowSeconds}s`,
    },
  },
  thresholds: {
    successful_200_requests: [`count<=${maxRequests}`],
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
