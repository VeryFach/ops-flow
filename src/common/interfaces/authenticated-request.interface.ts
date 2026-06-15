import type { Request } from 'express';
import type { UserRole, ProjectMember, WorkspaceMember } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
  params: Record<string, string>;
  body: Record<string, unknown>;
  projectMember?: ProjectMember;
  workspaceMember?: WorkspaceMember;
  oldBody?: Record<string, unknown>;
}
