import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { EditUserDto } from './dto/edit-user.dto';
import type { AuthUser } from '../../common/interfaces/authenticated-request.interface';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUserId = 'user-1';
  const mockUser: AuthUser = {
    id: mockUserId,
    name: 'Test User',
    email: 'test@example.com',
    role: 'USER',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockCurrentUser = { id: mockUserId, role: 'USER' };

  const mockUsersService = {
    getMe: jest.fn(),
    editUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe('getMe', () => {
    it('should return current user profile', async () => {
      mockUsersService.getMe.mockResolvedValue(mockUser);

      const result = await controller.getMe(mockUser);

      expect(result).toEqual(mockUser);
      expect(mockUsersService.getMe).toHaveBeenCalledWith(mockCurrentUser);
    });
  });

  describe('editUser', () => {
    const editDto: EditUserDto = {
      name: 'Updated Name',
      email: 'updated@example.com',
    };

    it('should update user profile', async () => {
      const updatedUser = { ...mockUser, ...editDto };
      mockUsersService.editUser.mockResolvedValue(updatedUser);

      const result = await controller.editUser(mockUser, editDto);

      expect(result.name).toBe('Updated Name');
      expect(result.email).toBe('updated@example.com');
      expect(mockUsersService.editUser).toHaveBeenCalledWith(
        mockCurrentUser,
        mockUserId,
        editDto,
      );
    });
  });
});
