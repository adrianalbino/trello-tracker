const axios = require('axios');
const config = require('../config/config');
const CacheService = require('./cacheService');

/**
 * @typedef {Object} Board
 * @property {string} id - Board ID
 * @property {string} name - Board name
 */

/**
 * @typedef {Object} Action
 * @property {string} type - Action type
 * @property {Object} data - Action data
 * @property {Object} data.card - Card information
 * @property {Object} [data.listBefore] - Previous list
 * @property {Object} [data.listAfter] - New list
 */

class TrelloService {
    /**
     * @param {Object} [options]
     * @param {string} [options.apiKey] - Trello API key
     * @param {string} [options.token] - Trello token
     * @param {CacheService} [options.cacheService] - Cache service instance
     */
    constructor(options = {}) {
        this.apiKey = options.apiKey || config.trello.apiKey;
        this.token = options.token || config.trello.token;
        this.baseURL = 'https://api.trello.com/1';
        this.cacheService = options.cacheService || new CacheService();

        if (!this.apiKey || !this.token) {
            throw new Error('Trello API key and token are required');
        }
    }

    /**
     * Get common request parameters
     * @private
     * @returns {Object} Common parameters
     */
    getCommonParams() {
        return {
            key: this.apiKey,
            token: this.token
        };
    }

    /**
     * Fetch boards from Trello
     * @param {boolean} [forceFresh=false] - Force fresh data fetch
     * @returns {Promise<Board[]>} List of boards
     */
    async getBoards(forceFresh = false) {
        const cacheKey = 'boards';
        
        try {
            if (!forceFresh) {
                const cached = await this.cacheService.get(cacheKey, 
                    () => this.fetchBoards());
                if (cached) return cached;
            }

            return await this.fetchBoards();
        } catch (error) {
            console.error('Error fetching boards:', error.message);
            throw new Error(`Failed to fetch boards: ${error.message}`);
        }
    }

    /**
     * Fetch boards directly from Trello API
     * @private
     * @returns {Promise<Board[]>}
     */
    async fetchBoards() {
        const response = await axios.get(`${this.baseURL}/members/me/boards`, {
            params: this.getCommonParams()
        });
        
        const boards = response.data.map(board => ({
            id: board.id,
            name: board.name
        }));

        await this.cacheService.set('boards', boards);
        return boards;
    }

    /**
     * Fetch board actions from Trello
     * @param {string} boardId - Board ID
     * @param {boolean} [forceFresh=false] - Force fresh data fetch
     * @returns {Promise<Action[]>} List of actions
     */
    async getBoardActions(boardId, forceFresh = false) {
        if (!boardId) {
            throw new Error('Board ID is required');
        }

        const cacheKey = `board_actions_${boardId}`;
        
        try {
            if (!forceFresh) {
                const cached = await this.cacheService.get(cacheKey,
                    () => this.fetchBoardActions(boardId));
                if (cached) return cached;
            }

            return await this.fetchBoardActions(boardId);
        } catch (error) {
            console.error('Error fetching board actions:', error.message);
            throw new Error(`Failed to fetch board actions: ${error.message}`);
        }
    }

    /**
     * Fetch board actions directly from Trello API
     * @private
     * @param {string} boardId - Board ID
     * @returns {Promise<Action[]>}
     */
    async fetchBoardActions(boardId) {
        const response = await axios.get(`${this.baseURL}/boards/${boardId}/actions`, {
            params: {
                ...this.getCommonParams(),
                filter: 'updateCard'
            }
        });
        
        const actions = response.data.filter(action => 
            action.type === 'updateCard' && 
            (action.data.listBefore || action.data.listAfter)
        );

        await this.cacheService.set(`board_actions_${boardId}`, actions);
        return actions;
    }
}

module.exports = TrelloService;
