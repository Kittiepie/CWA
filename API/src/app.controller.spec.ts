import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { expect } from '@jest/globals';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('should be defined', () => {
    expect(appController).toBeDefined();
  });

  describe('healthCheck', () => {
    it('should return "Server is healthy"', async () => {
      const response = await appController.healthCheck();
      expect(response.success).toBe(true);
      if (!response.success) return; // ensure type

      expect(response.data).toEqual({
        status: 'ok',
        uptime: expect.any(Number),
      });
    });
  });
});
