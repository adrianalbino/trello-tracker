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
    let consoleErrorSpy;

    beforeEach(() => {
        cacheService = new CacheService('.cache');
        jest.clearAllMocks();
        // Mock console.error before each test
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
        // Restore console.error after each test
        consoleErrorSpy.mockRestore();
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
            const enoentError = new Error('ENOENT: no such file');
            enoentError.code = 'ENOENT';  // Set the error code
            fs.readFile.mockRejectedValueOnce(enoentError);
            
            const result = await cacheService.get('nonexistent-key');
            expect(result).toBeNull();
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('should handle invalid JSON data', async () => {
            fs.readFile.mockResolvedValueOnce('invalid json');
            const result = await cacheService.get('test-key');
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Cache read error:',
                expect.any(SyntaxError)
            );
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
            const enoentError = new Error('ENOENT: no such directory');
            enoentError.code = 'ENOENT';
            fs.writeFile.mockRejectedValueOnce(enoentError);
            fs.writeFile.mockResolvedValueOnce(undefined);
            fs.mkdir.mockResolvedValueOnce(undefined);
            
            const testData = { test: 'data' };
            await cacheService.set('test-key', testData);
            
            expect(fs.mkdir).toHaveBeenCalledWith('.cache', { recursive: true });
            expect(fs.writeFile).toHaveBeenCalledTimes(2);
        });

        it('should handle other write errors', async () => {
            const permError = new Error('EPERM: permission denied');
            permError.code = 'EPERM';
            fs.writeFile.mockRejectedValueOnce(permError);
            
            const testData = { test: 'data' };
            await expect(cacheService.set('test-key', testData))
                .rejects.toThrow('EPERM: permission denied');
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Cache write error:',
                expect.any(Error)
            );
        });

        it('should retry write after creating directory', async () => {
            const enoentError = new Error('ENOENT: no such directory');
            enoentError.code = 'ENOENT';
            fs.writeFile.mockRejectedValueOnce(enoentError);
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
            const error = new Error('ENOENT: no such file');
            error.code = 'ENOENT';
            fs.unlink.mockRejectedValueOnce(error);
            
            await expect(cacheService.delete('nonexistent-key')).resolves.not.toThrow();
        });

        it('should handle delete errors', async () => {
            const error = new Error('Delete failed');
            fs.unlink.mockRejectedValueOnce(error);
            
            await expect(cacheService.delete('test-key'))
                .rejects.toThrow('Delete failed');
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Cache delete error:',
                error
            );
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

            const result = await cacheService.get('test-key', fetchFresh);
            
            // Should return stale data
            expect(result).toEqual(mockData.value);
            
            // Wait for any pending promises to resolve
            await new Promise(resolve => setTimeout(resolve, 0));
            
            // Verify error was logged
            expect(consoleErrorSpy).toHaveBeenCalledWith('Cache refresh error:', expect.any(Error));
        });
    });
});
