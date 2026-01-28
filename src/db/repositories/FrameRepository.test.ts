/**
 * FrameRepository Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, closeTestDb, createTestFrame } from '../../__tests__/helpers/testDb.js';
import type { DatabaseContext } from '../client.js';

describe('FrameRepository', () => {
  let db: DatabaseContext;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    closeTestDb(db);
  });

  describe('create', () => {
    it('should insert frame with all fields', async () => {
      const frameId = await createTestFrame(db.frameRepo, {
        name: 'Test Frame',
        description: 'Test description',
        keywords: ['keyword1', 'keyword2']
      });

      const frame = await db.frameRepo.findById(frameId);

      expect(frame).not.toBeNull();
      expect(frame?.name).toBe('Test Frame');
      expect(frame?.description).toBe('Test description');
      expect(JSON.parse(frame?.keywords || '[]')).toEqual(['keyword1', 'keyword2']);
    });

    it('should return frame ID', async () => {
      const frameId = await createTestFrame(db.frameRepo, {
        id: 'custom-id-123'
      });

      expect(frameId).toBe('custom-id-123');
    });

    it('should set default status to active', async () => {
      const frameId = await createTestFrame(db.frameRepo);
      const frame = await db.frameRepo.findById(frameId);

      expect(frame?.status).toBe('active');
    });
  });

  describe('findById', () => {
    it('should return frame by ID', async () => {
      const frameId = await createTestFrame(db.frameRepo, {
        name: 'Find Me'
      });

      const frame = await db.frameRepo.findById(frameId);

      expect(frame).not.toBeNull();
      expect(frame?.name).toBe('Find Me');
    });

    it('should return null for non-existent ID', async () => {
      const frame = await db.frameRepo.findById('non-existent-id');

      expect(frame).toBeNull();
    });
  });

  describe('findActive', () => {
    it('should return only active frames', async () => {
      await createTestFrame(db.frameRepo, { name: 'Active 1', status: 'active' });
      await createTestFrame(db.frameRepo, { name: 'Active 2', status: 'active' });
      await createTestFrame(db.frameRepo, { name: 'Paused', status: 'paused' });

      const frames = await db.frameRepo.findActive();

      expect(frames).toHaveLength(2);
      expect(frames.every(f => f.status === 'active')).toBe(true);
    });

    it('should exclude paused frames', async () => {
      await createTestFrame(db.frameRepo, { name: 'Active', status: 'active' });
      await createTestFrame(db.frameRepo, { name: 'Paused', status: 'paused' });

      const frames = await db.frameRepo.findActive();

      expect(frames).toHaveLength(1);
      expect(frames[0].name).toBe('Active');
    });

    it('should exclude deleted frames', async () => {
      await createTestFrame(db.frameRepo, { name: 'Active', status: 'active' });
      await createTestFrame(db.frameRepo, { name: 'Deleted', status: 'deleted' });

      const frames = await db.frameRepo.findActive();

      expect(frames).toHaveLength(1);
      expect(frames[0].name).toBe('Active');
    });
  });

  describe('findAll', () => {
    it('should include paused frames', async () => {
      await createTestFrame(db.frameRepo, { name: 'Active', status: 'active' });
      await createTestFrame(db.frameRepo, { name: 'Paused', status: 'paused' });

      const frames = await db.frameRepo.findAll();

      expect(frames).toHaveLength(2);
    });

    it('should exclude deleted frames', async () => {
      await createTestFrame(db.frameRepo, { name: 'Active', status: 'active' });
      await createTestFrame(db.frameRepo, { name: 'Deleted', status: 'deleted' });

      const frames = await db.frameRepo.findAll();

      expect(frames).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('should update specified fields', async () => {
      const frameId = await createTestFrame(db.frameRepo, { name: 'Original' });

      await db.frameRepo.update(frameId, { name: 'Updated' });

      const frame = await db.frameRepo.findById(frameId);
      expect(frame?.name).toBe('Updated');
    });

    it('should not change unspecified fields', async () => {
      const frameId = await createTestFrame(db.frameRepo, {
        name: 'Original',
        description: 'Keep this'
      });

      await db.frameRepo.update(frameId, { name: 'Updated' });

      const frame = await db.frameRepo.findById(frameId);
      expect(frame?.description).toBe('Keep this');
    });
  });

  describe('delete', () => {
    it('should soft delete by setting status', async () => {
      const frameId = await createTestFrame(db.frameRepo, { status: 'active' });

      await db.frameRepo.delete(frameId);

      const frame = await db.frameRepo.findById(frameId);
      expect(frame?.status).toBe('deleted');
    });
  });

  describe('pause', () => {
    it('should set status to paused', async () => {
      const frameId = await createTestFrame(db.frameRepo, { status: 'active' });

      await db.frameRepo.pause(frameId);

      const frame = await db.frameRepo.findById(frameId);
      expect(frame?.status).toBe('paused');
    });
  });

  describe('activate', () => {
    it('should set status to active', async () => {
      const frameId = await createTestFrame(db.frameRepo, { status: 'paused' });

      await db.frameRepo.activate(frameId);

      const frame = await db.frameRepo.findById(frameId);
      expect(frame?.status).toBe('active');
    });
  });
});
