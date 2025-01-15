const axios = require('axios');
const TrelloService = require('../trelloService');
const CacheService = require('../cacheService');

// Mock both axios and CacheService
jest.mock('axios');
jest.mock('../cacheService');

describe('TrelloService', () => {
    let trelloService;
    let mockCacheGet;
    let mockCacheSet;

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();
        
        // Setup cache mock methods
        mockCacheGet = jest.fn().mockResolvedValue(null);
        mockCacheSet = jest.fn().mockResolvedValue();
        
        CacheService.mockImplementation(() => ({
            get: mockCacheGet,
            set: mockCacheSet
        }));

        trelloService = new TrelloService();
    });

    describe('getBoards', () => {
        it('should fetch and format boards correctly', async () => {
            const mockBoards = [
                { id: 'board1', name: 'Board 1', otherField: 'value' },
                { id: 'board2', name: 'Board 2', otherField: 'value' }
            ];

            mockCacheGet.mockResolvedValueOnce(null);
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

        it('should return cached boards if available', async () => {
            const cachedBoards = [
                { id: 'board1', name: 'Cached Board' }
            ];
            mockCacheGet.mockResolvedValueOnce(cachedBoards);

            const result = await trelloService.getBoards();
            expect(result).toEqual(cachedBoards);
            expect(axios.get).not.toHaveBeenCalled();
        });

        it('should handle errors appropriately', async () => {
            mockCacheGet.mockResolvedValueOnce(null);
            axios.get.mockRejectedValueOnce(new Error('Network error'));

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

            mockCacheGet.mockResolvedValueOnce(null);
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

        it('should return cached actions if available', async () => {
            const cachedActions = [{ type: 'updateCard', data: { card: { name: 'Cached Card' } } }];
            mockCacheGet.mockResolvedValueOnce(cachedActions);

            const result = await trelloService.getBoardActions('board123');
            expect(result).toEqual(cachedActions);
            expect(axios.get).not.toHaveBeenCalled();
        });

        it('should handle errors appropriately', async () => {
            mockCacheGet.mockResolvedValueOnce(null);
            axios.get.mockRejectedValueOnce(new Error('Network error'));

            await expect(trelloService.getBoardActions('board123')).rejects.toThrow('Network error');
        });
    });
});
