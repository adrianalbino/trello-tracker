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
            expect(fs.writeFile).toHaveBeenCalledTimes(2); // First fails, second succeeds
        });

        it('should handle other write errors', async () => {
            fs.writeFile.mockRejectedValueOnce(new Error('EPERM: permission denied'));
            
            
            const testData = { test: 'data' };
            await expect(cacheService.set('test-key', testData))
                .rejects.toThrow('EPERM: permission denied');

            expect(fs.mkdir).not.toHaveBeenCalled();
        });

        it('should retry write after creating directory', async () => {
            // First write fails with ENOENT
            fs.writeFile.mockRejectedValueOnce(new Error('ENOENT: no such directory'));
            // Second write succeeds
            fs.writeFile.mockResolvedValueOnce(undefined);
            fs.mkdir.mockResolvedValueOnce(undefined);

            const testData = { test: 'data' };
            await cacheService.set('test-key', testData);

            expect(fs.mkdir).toHaveBeenCalledWith('.cache', { recursive: true });
            expect(fs.writeFile).toHaveBeenCalledTimes(2);
        });
    });

    describe('delete', () => {
        it('should delete cache file if it exists', async () => {
            await cacheService.delete('test-key');
            expect(fs.unlink).toHaveBeenCalledWith(
                path.join('.cache', 'test-key.json')
            );
        });

        it('should handle non-existent file deletion gracefully', async () => {
            fs.unlink.mockRejectedValueOnce(new Error('ENOENT: no such file'));
            await expect(cacheService.delete('nonexistent-key')).resolves.not.toThrow();
        });
    });

    describe('cache refresh functionality', () => {
        it('should trigger background refresh for stale data', async () => {
            const mockData = {
                timestamp: Date.now() - (2 * 60 * 60 * 1000), // 2 hours ago (stale but not expired)
                value: { test: 'data' }
            };

            const fetchFresh = jest.fn().mockResolvedValue({ test: 'fresh data' });
            fs.readFile.mockResolvedValueOnce(JSON.stringify(mockData));

            const result = await cacheService.get('test-key', fetchFresh);
            
            // Should return stale data immediately
            expect(result).toEqual(mockData.value);
            
            // Wait for any pending promises to resolve
            await new Promise(resolve => setTimeout(resolve, 0));
            
            // Verify background refresh was triggered
            expect(fetchFresh).toHaveBeenCalled();
            expect(fs.writeFile).toHaveBeenCalled();
            const writeData = JSON.parse(fs.writeFile.mock.calls[0][1]);
            expect(writeData.value).toEqual({ test: 'fresh data' });
        });

        it('should handle refresh errors gracefully', async () => {
            const mockData = {
                timestamp: Date.now() - (2 * 60 * 60 * 1000),
                value: { test: 'data' }
            };

            const fetchFresh = jest.fn().mockRejectedValue(new Error('Refresh failed'));
            fs.readFile.mockResolvedValueOnce(JSON.stringify(mockData));

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            const result = await cacheService.get('test-key', fetchFresh);
            
            // Should return stale data
            expect(result).toEqual(mockData.value);
            
            // Wait for any pending promises to resolve
            await new Promise(resolve => setTimeout(resolve, 0));
            
            // Verify error was logged
            expect(consoleSpy).toHaveBeenCalledWith('Cache refresh error:', expect.any(Error));
            
            consoleSpy.mockRestore();
        });
    });
});
