const fs = require('fs').promises;
const path = require('path');

class CacheService {
    constructor(cachePath = '.cache') {
        this.cachePath = cachePath;
        this.cacheLifetime = 24 * 60 * 60 * 1000; // 24 hours
        this.staleAfter = 1 * 60 * 60 * 1000;     // 1 hour - check for updates after this
    }

    async getCacheFilePath(key) {
        await fs.mkdir(this.cachePath, { recursive: true });
        return path.join(this.cachePath, `${key}.json`);
    }

    async get(key, fetchFresh) {
        try {
            const filePath = await this.getCacheFilePath(key);
            const data = await fs.readFile(filePath, 'utf8');
            const { timestamp, value } = JSON.parse(data);

            const age = Date.now() - timestamp;
            
            // If data is too old, delete and return null
            if (age > this.cacheLifetime) {
                await this.delete(key);
                return null;
            }

            // If data is stale but not expired, trigger background refresh
            if (age > this.staleAfter && fetchFresh) {
                this.refreshCache(key, fetchFresh).catch(console.error);
            }

            return value;
        } catch (error) {
            return null;
        }
    }

    async refreshCache(key, fetchFresh) {
        try {
            const freshData = await fetchFresh();
            await this.set(key, freshData);
        } catch (error) {
            console.error('Cache refresh error:', error);
        }
    }

    async set(key, value) {
        const filePath = path.join(this.cachePath, `${key}.json`);
        const data = {
            timestamp: Date.now(),
            value
        };
        
        try {
            await fs.writeFile(filePath, JSON.stringify(data));
        } catch (error) {
            console.error('Cache write error:', error);
            if (error.message.includes('ENOENT')) {
                await fs.mkdir(this.cachePath, { recursive: true });
                // Retry write after creating directory
                await fs.writeFile(filePath, JSON.stringify(data));
            } else {
                throw error;
            }
        }
    }

    async delete(key) {
        try {
            const filePath = await this.getCacheFilePath(key);
            await fs.unlink(filePath);
        } catch (error) {
            // Ignore if file doesn't exist
        }
    }
}

module.exports = CacheService;
