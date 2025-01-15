const fs = require('fs').promises;
const path = require('path');
const CacheService = require('../cacheService');

jest.mock('fs', () => ({
    promises: {
        mkdir: jest.fn(),
        readFile: jest.fn(),
        writeFile: jest.fn(),
        unlink: jest.fn()
    }
}));

describe('CacheService', () => {
    let cacheService;

    beforeEach(() => {
        cacheService = new CacheService('.cache');
        jest.clearAllMocks();
    });

    describe('get', () => {
        it('should return cached value if not expired', async () => {
            const mockData = {
                timestamp: Date.now(),
                value: { test: 'data' }
            };

            fs.readFile.mockResolvedValueOnce(JSON.stringify(mockData));

            const result = await cacheService.get('test-key');
            expect(result).toEqual(mockData.value);
        });

        it('should return null for expired cache', async () => {
            const mockData = {
                timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
                value: { test: 'data' }
            };

            fs.readFile.mockResolvedValueOnce(JSON.stringify(mockData));

            const result = await cacheService.get('test-key');
            expect(result).toBeNull();
        });

        it('should handle file not found errors', async () => {
            fs.readFile.mockRejectedValueOnce(new Error('ENOENT: no such file'));
            const result = await cacheService.get('nonexistent-key');
            expect(result).toBeNull();
        });

        it('should handle invalid JSON data', async () => {
            fs.readFile.mockResolvedValueOnce('invalid json');
            const result = await cacheService.get('test-key');
            expect(result).toBeNull();
        });
    });

    describe('set', () => {
        it('should write data to cache file', async () => {
            const testData = { test: 'data' };
            await cacheService.set('test-key', testData);

            expect(fs.writeFile).toHaveBeenCalled();
            const writeData = JSON.parse(fs.writeFile.mock.calls[0][1]);
            expect(writeData.value).toEqual(testData);
        });

        it('should create cache directory if it doesn\'t exist', async () => {
            fs.writeFile.mockRejectedValueOnce(new Error('ENOENT: no such directory'));
            
            const testData = { test: 'data' };
            await cacheService.set('test-key', testData);

            expect(fs.mkdir).toHaveBeenCalledWith('.cache', { recursive: true });
            expect(fs.writeFile).toHaveBeenCalledTimes(1);
        });

        it('should handle other write errors', async () => {
            // Simulate a different type of error (e.g., permission denied)
            fs.writeFile.mockRejectedValueOnce(new Error('EPERM: permission denied'));
            
            const testData = { test: 'data' };
            await expect(cacheService.set('test-key', testData))
                .rejects.toThrow('EPERM: permission denied');

            expect(fs.mkdir).not.toHaveBeenCalled(); // Verify we don't try to create directory
        });
    });
});
