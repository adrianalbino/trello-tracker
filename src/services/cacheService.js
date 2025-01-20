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
            const { timestamp, value } = JSON.parse(data);

            const age = Date.now() - timestamp;
            
            if (age > this.cacheLifetime) {
                await this.delete(key);
                return null;
            }

            if (age > this.staleAfter && fetchFresh) {
                this.refreshCache(key, fetchFresh)
                    .catch(error => console.error('Background refresh failed:', error));
            }

            return value;
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Cache read error:', error);
            }
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
        
        try {
            const filePath = await this.getCacheFilePath(key);
            await fs.writeFile(filePath, JSON.stringify(data));
        } catch (error) {
            console.error('Cache write error:', error);
            throw error;
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
            if (error.code !== 'ENOENT') {
                console.error('Cache delete error:', error);
                throw error;
            }
        }
    }
}

module.exports = CacheService;
