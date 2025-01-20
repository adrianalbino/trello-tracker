const fs = require('fs').promises;
const path = require('path');

/**
 * @typedef {Object} CacheOptions
 * @property {string} [cachePath='.cache'] - Path to cache directory
 * @property {number} [lifetime=86400000] - Cache lifetime in milliseconds
 * @property {number} [staleAfter=3600000] - Time after which to check for updates
 */

/**
 * Service for handling file-based caching
 */
class CacheService {
    /**
     * @param {CacheOptions} options
     */
    constructor(options = {}) {
        const {
            cachePath = '.cache',
            lifetime = 24 * 60 * 60 * 1000,
            staleAfter = 1 * 60 * 60 * 1000
        } = options;

        this.cachePath = cachePath;
        this.cacheLifetime = lifetime;
        this.staleAfter = staleAfter;
    }

    /**
     * Ensures cache directory exists
     * @private
     */
    async ensureCacheDirectory() {
        await fs.mkdir(this.cachePath, { recursive: true });
    }

    /**
     * Gets cache file path for a key
     * @param {string} key - Cache key
     * @returns {Promise<string>} Full path to cache file
     */
    async getCacheFilePath(key) {
        await this.ensureCacheDirectory();
        return path.join(this.cachePath, `${key}.json`);
    }

    /**
     * Retrieves value from cache
     * @param {string} key - Cache key
     * @param {Function} [fetchFresh] - Function to fetch fresh data
     * @returns {Promise<any>} Cached value or null
     */
    async get(key, fetchFresh) {
        try {
            const filePath = await this.getCacheFilePath(key);
            const data = await fs.readFile(filePath, 'utf8');
            
            let parsed;
            try {
                parsed = JSON.parse(data);
            } catch (parseError) {
                console.error('Cache read error:', parseError);
                return null;
            }

            const { timestamp, value } = parsed;
            const age = Date.now() - timestamp;
            
            if (age > this.cacheLifetime) {
                await this.delete(key);
                return null;
            }

            if (age > this.staleAfter && fetchFresh) {
                this.refreshCache(key, fetchFresh)
                    .catch(error => {
                        console.error('Background refresh failed:', error);
                        return null;
                    });
            }

            return value;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            
            console.error('Cache read error:', error);
            return null;
        }
    }

    /**
     * Refreshes cache with fresh data
     * @private
     */
    async refreshCache(key, fetchFresh) {
        try {
            const freshData = await fetchFresh();
            await this.set(key, freshData);
        } catch (error) {
            console.error('Cache refresh error:', error);
            throw error;
        }
    }

    /**
     * Sets value in cache
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     */
    async set(key, value) {
        const data = {
            timestamp: Date.now(),
            value
        };
        
        const filePath = await this.getCacheFilePath(key);
        
        try {
            await fs.writeFile(filePath, JSON.stringify(data));
        } catch (error) {
            console.error('Cache write error:', error);
            if (error.code === 'ENOENT') {
                await this.ensureCacheDirectory();
                // Retry write after creating directory
                await fs.writeFile(filePath, JSON.stringify(data));
                return;
            }
            throw error;  // Re-throw non-ENOENT errors
        }
    }

    /**
     * Deletes value from cache
     * @param {string} key - Cache key
     */
    async delete(key) {
        try {
            const filePath = await this.getCacheFilePath(key);
            await fs.unlink(filePath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // Silently ignore non-existent files
                return;
            }
            console.error('Cache delete error:', error);
            throw error;
        }
    }
}

module.exports = CacheService;
