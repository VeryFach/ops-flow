import { SetMetadata } from '@nestjs/common';

export const SKIP_AUDIT_KEY = 'skip-audit';

/**
 * Decorator to skip audit logging for specific endpoints
 * @example
 * @SkipAudit()
 * @Get('health')
 * healthCheck() { return 'ok'; }
 */
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_KEY, true);