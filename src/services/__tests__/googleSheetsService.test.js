const { google } = require('googleapis');
const GoogleSheetsService = require('../googleSheetsService');

// Mock googleapis
jest.mock('googleapis', () => ({
    google: {
        auth: {
            GoogleAuth: jest.fn()
        },
        sheets: jest.fn()
    }
}));

describe('GoogleSheetsService', () => {
    let service;
    let mockAuth;
    let mockSheets;
    let consoleErrorSpy;
    
    beforeEach(() => {
        // Mock console.error
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        
        // Reset mocks
        mockAuth = {
            getClient: jest.fn().mockResolvedValue('mock-auth-client')
        };
        
        mockSheets = {
            spreadsheets: {
                values: {
                    get: jest.fn(),
                    clear: jest.fn().mockResolvedValue({}),
                    update: jest.fn().mockResolvedValue({})
                }
            }
        };

        // Setup mocks
        google.auth.GoogleAuth.mockImplementation(() => mockAuth);
        google.sheets.mockImplementation(() => mockSheets);

        // Create service instance
        service = new GoogleSheetsService();
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        jest.clearAllMocks();
    });

    describe('initialize', () => {
        it('should initialize Google Sheets API successfully', async () => {
            await service.initialize();

            expect(google.auth.GoogleAuth).toHaveBeenCalledWith({
                keyFile: expect.stringContaining('credentials.json'),
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });
            expect(service.initialized).toBe(true);
        });

        it('should not reinitialize if already initialized', async () => {
            service.initialized = true;
            await service.initialize();
            expect(google.auth.GoogleAuth).not.toHaveBeenCalled();
        });

        it('should handle initialization errors', async () => {
            mockAuth.getClient.mockRejectedValue(new Error('Auth failed'));
            await expect(service.initialize()).rejects.toThrow('Google Sheets initialization failed');
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe('readExistingMovements', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        it('should read and parse movements correctly', async () => {
            const mockResponse = {
                data: {
                    values: [
                        ['Card Name', 'Old Board/List Name', 'New Board/List Name', 'Timestamp'],
                        ['Card 1', 'List A', 'List B', '2024-01-01'],
                        ['Card 2', 'List B', 'List C', '2024-01-02']
                    ]
                }
            };
            mockSheets.spreadsheets.values.get.mockResolvedValue(mockResponse);

            const result = await service.readExistingMovements('test-sheet-id');

            expect(result).toEqual([
                {
                    cardName: 'Card 1',
                    oldLocation: 'List A',
                    newLocation: 'List B',
                    timestamp: '2024-01-01'
                },
                {
                    cardName: 'Card 2',
                    oldLocation: 'List B',
                    newLocation: 'List C',
                    timestamp: '2024-01-02'
                }
            ]);
        });

        it('should handle empty sheets', async () => {
            mockSheets.spreadsheets.values.get.mockResolvedValue({ data: { values: [] } });
            const result = await service.readExistingMovements('test-sheet-id');
            expect(result).toEqual([]);
        });

        it('should handle missing values in response', async () => {
            mockSheets.spreadsheets.values.get.mockResolvedValue({ data: {} });
            const result = await service.readExistingMovements('test-sheet-id');
            expect(result).toEqual([]);
        });

        it('should handle API errors', async () => {
            mockSheets.spreadsheets.values.get.mockRejectedValue(new Error('API Error'));
            await expect(service.readExistingMovements('test-sheet-id'))
                .rejects.toThrow('Failed to read from Google Sheet: API Error');
        });
    });

    describe('writeMovements', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        it('should validate input parameters', async () => {
            await expect(service.writeMovements()).rejects.toThrow('Spreadsheet ID is required');
            await expect(service.writeMovements('sheet-id')).rejects.toThrow('Movements must be an array');
        });

        it('should write new movements and skip existing ones', async () => {
            // Mock existing movements
            mockSheets.spreadsheets.values.get.mockResolvedValue({
                data: {
                    values: [
                        ['Card Name', 'Old Board/List Name', 'New Board/List Name', 'Timestamp'],
                        ['Existing Card', 'List A', 'List B', '2024-01-01']
                    ]
                }
            });

            const newMovements = [
                {
                    cardName: 'New Card',
                    oldLocation: 'List X',
                    newLocation: 'List Y',
                    timestamp: '2024-01-02'
                }
            ];

            await service.writeMovements('test-sheet-id', newMovements);

            expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledWith({
                spreadsheetId: 'test-sheet-id',
                range: 'Sheet1!A1',
                valueInputOption: 'RAW',
                resource: {
                    values: expect.arrayContaining([
                        ['Card Name', 'Old Board/List Name', 'New Board/List Name', 'Timestamp of Movement'],
                        ['Existing Card', 'List A', 'List B', '2024-01-01'],
                        ['New Card', 'List X', 'List Y', '2024-01-02']
                    ])
                }
            });
        });

        it('should handle case when no new movements need to be written', async () => {
            const existingMovement = {
                cardName: 'Card',
                oldLocation: 'List A',
                newLocation: 'List B',
                timestamp: '2024-01-01'
            };

            mockSheets.spreadsheets.values.get.mockResolvedValue({
                data: {
                    values: [
                        ['Card Name', 'Old Board/List Name', 'New Board/List Name', 'Timestamp'],
                        ['Card', 'List A', 'List B', '2024-01-01']
                    ]
                }
            });

            await service.writeMovements('test-sheet-id', [existingMovement]);

            expect(mockSheets.spreadsheets.values.clear).not.toHaveBeenCalled();
            expect(mockSheets.spreadsheets.values.update).not.toHaveBeenCalled();
        });

        it('should handle API errors during write', async () => {
            // Mock successful read of existing movements first
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: {
                    values: [
                        ['Card Name', 'Old Board/List Name', 'New Board/List Name', 'Timestamp'],
                        ['Existing Card', 'List A', 'List B', '2024-01-01']
                    ]
                }
            });
            
            // Mock the clear operation to fail
            mockSheets.spreadsheets.values.clear.mockRejectedValueOnce(new Error('API Error'));
            
            await expect(service.writeMovements('test-sheet-id', [{
                cardName: 'Test',
                oldLocation: 'A',
                newLocation: 'B',
                timestamp: '2024-01-01'
            }])).rejects.toThrow('Failed to write to Google Sheet: API Error');
        });
    });
});