const axios = require('axios');
const config = require('../config/config');

class TrelloService {
    constructor() {
        this.apiKey = config.trello.apiKey;
        this.token = config.trello.token;
        this.baseURL = 'https://api.trello.com/1';
    }

    async getBoards() {
        try {
            const response = await axios.get(`${this.baseURL}/members/me/boards`, {
                params: {
                    key: this.apiKey,
                    token: this.token
                }
            });
            
            return response.data.map(board => ({
                id: board.id,
                name: board.name
            }));
        } catch (error) {
            console.error('Error fetching boards:', error.message);
            throw error;
        }
    }

    async getBoardActions(boardId) {
        try {
            const response = await axios.get(`${this.baseURL}/boards/${boardId}/actions`, {
                params: {
                    key: this.apiKey,
                    token: this.token,
                    filter: 'updateCard'
                }
            });
            
            return response.data.filter(action => 
                action.type === 'updateCard' && 
                (action.data.listBefore || action.data.listAfter)
            );
        } catch (error) {
            console.error('Error fetching board actions:', error.message);
            throw error;
        }
    }
}

module.exports = TrelloService;
