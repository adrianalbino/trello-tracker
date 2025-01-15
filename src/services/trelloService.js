const axios = require('axios');
const config = require('../config/config');
const CacheService = require('./cacheService');

class TrelloService {
    constructor() {
        this.apiKey = config.trello.apiKey;
        this.token = config.trello.token;
        this.baseURL = 'https://api.trello.com/1';
        this.cacheService = new CacheService();
    }

    async getBoards() {
        try {
            // Check cache first
            const cachedBoards = await this.cacheService.get('boards');
            if (cachedBoards) {
                return cachedBoards;
            }

            const response = await axios.get(`${this.baseURL}/members/me/boards`, {
                params: {
                    key: this.apiKey,
                    token: this.token
                }
            });
            
            const boards = response.data.map(board => ({
                id: board.id,
                name: board.name
            }));

            // Cache the results
            await this.cacheService.set('boards', boards);
            
            return boards;
        } catch (error) {
            console.error('Error fetching boards:', error.message);
            throw error;
        }
    }

    async getBoardActions(boardId) {
        try {
            // Check cache first
            const cacheKey = `board_actions_${boardId}`;
            const cachedActions = await this.cacheService.get(cacheKey);
            if (cachedActions) {
                return cachedActions;
            }

            const response = await axios.get(`${this.baseURL}/boards/${boardId}/actions`, {
                params: {
                    key: this.apiKey,
                    token: this.token,
                    filter: 'updateCard'
                }
            });
            
            const actions = response.data.filter(action => 
                action.type === 'updateCard' && 
                (action.data.listBefore || action.data.listAfter)
            );

            // Cache the results
            await this.cacheService.set(cacheKey, actions);
            
            return actions;
        } catch (error) {
            console.error('Error fetching board actions:', error.message);
            throw error;
        }
    }
}

module.exports = TrelloService;
