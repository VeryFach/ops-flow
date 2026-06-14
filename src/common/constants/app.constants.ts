export const APP_CONSTANTS = {
    // Pagination
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,

    // Rate Limiting
    RATE_LIMIT_TTL: 60, // seconds
    RATE_LIMIT_MAX: 100, // requests per TTL

    // JWT
    JWT_EXPIRES_IN: '1d',

    // Cookie
    COOKIE_NAME: 'cookie_token',
    COOKIE_MAX_AGE: 24 * 60 * 60 * 1000, // 1 day

    // Deployment
    DEPLOYMENT_BUILD_DELAY: 5000, // 5 seconds
    DEPLOYMENT_DEPLOY_DELAY: 5000, // 5 seconds

    // Cache
    CACHE_TTL: 60 * 60, // 1 hour
} as const;