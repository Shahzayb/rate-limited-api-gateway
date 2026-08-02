-- KEYS[1] = rl:{policyId}:{identifier}
-- ARGV[1] = max_requests, ARGV[2] = window_ms
local key = KEYS[1]
local max_requests = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])

local t = redis.call('TIME')
local now_ms = math.floor(tonumber(t[1]) * 1000 + tonumber(t[2]) / 1000)
local window_start = now_ms - window_ms

redis.call('ZREMRANGEBYSCORE', key, '-inf', '(' .. window_start)
local current = redis.call('ZCARD', key)
local allowed = current < max_requests

if allowed then
  -- Unique member without a second counter key: NX-add, bump suffix on collision.
  local suffix = 0
  while redis.call('ZADD', key, 'NX', now_ms, now_ms .. '-' .. suffix) == 0 do
    suffix = suffix + 1
  end
  current = current + 1
end

redis.call('PEXPIRE', key, window_ms + 1000)

local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local oldest_score = now_ms
if #oldest > 0 then oldest_score = tonumber(oldest[2]) end

return { current, max_requests, oldest_score, now_ms, allowed and 1 or 0 }