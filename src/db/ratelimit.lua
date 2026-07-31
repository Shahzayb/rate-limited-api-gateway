local key = KEYS[1]
local max_requests = tonumber(ARGV[1])
local window_seconds = tonumber(ARGV[2])

-- 1. Increment first (creates key with value 1 if it doesn't exist)
local current = redis.call('INCR', key)

-- 2. If it's a new key, set the expiration
if current == 1 then
    redis.call('EXPIRE', key, window_seconds)
end

-- 3. Safety check: ensure TTL exists even if key was modified outside this script
local ttl = redis.call('TTL', key)
if ttl == -1 then
    redis.call('EXPIRE', key, window_seconds)
    ttl = window_seconds
end

-- 4. Check limit AFTER incrementing
if current > max_requests then
    return { current, ttl }
end

return { current, ttl }