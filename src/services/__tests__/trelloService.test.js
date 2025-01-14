const axios = require('axios');
const TrelloService = require('../trelloService');

// Mock axios
jest.mock('axios');

describe('TrelloService', () => {
    let trelloService;

    beforeEach(() => {
        trelloService = new TrelloService();
    });

    describe('getBoards', () => {
        it('should fetch and format boards correctly', async () => {
            const mockBoards = [
                { id: 'board1', name: 'Board 1', otherField: 'value' },
                { id: 'board2', name: 'Board 2', otherField: 'value' }
            ];

            axios.get.mockResolvedValueOnce({ data: mockBoards });

            const result = await trelloService.getBoards();

            expect(axios.get).toHaveBeenCalledWith(
                'https://api.trello.com/1/members/me/boards',
                {
                    params: {
                        key: trelloService.apiKey,
                        token: trelloService.token
                    }
                }
            );

            expect(result).toEqual([
                { id: 'board1', name: 'Board 1' },
                { id: 'board2', name: 'Board 2' }
            ]);
        });

        it('should handle errors appropriately', async () => {
            const error = new Error('Network error');
            axios.get.mockRejectedValueOnce(error);

            await expect(trelloService.getBoards()).rejects.toThrow('Network error');
        });
    });

    describe('getBoardActions', () => {
        it('should fetch and filter board actions correctly', async () => {
            const mockActions = [
                {
                    type: 'updateCard',
                    data: {
                        listBefore: { name: 'List 1' },
                        listAfter: { name: 'List 2' }
                    }
                },
                {
                    type: 'updateCard',
                    data: {
                        listBefore: null,
                        listAfter: null
                    }
                }
            ];

            axios.get.mockResolvedValueOnce({ data: mockActions });

            const result = await trelloService.getBoardActions('board123');

            expect(axios.get).toHaveBeenCalledWith(
                'https://api.trello.com/1/boards/board123/actions',
                {
                    params: {
                        key: trelloService.apiKey,
                        token: trelloService.token,
                        filter: 'updateCard'
                    }
                }
            );

            expect(result).toHaveLength(1);
            expect(result[0].data.listBefore.name).toBe('List 1');
        });

        it('should handle errors appropriately', async () => {
            const error = new Error('Network error');
            axios.get.mockRejectedValueOnce(error);

            await expect(trelloService.getBoardActions('board123')).rejects.toThrow('Network error');
        });
    });
});
