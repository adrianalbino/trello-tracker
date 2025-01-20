const CsvService = require('../csvService');
const fs = require('fs').promises;
const csv = require('csv-parse');

// Mock the csv-writer module
jest.mock('csv-writer', () => ({
    createObjectCsvWriter: jest.fn().mockReturnValue({
        writeRecords: jest.fn().mockResolvedValue(undefined)
    })
}));

jest.mock('fs', () => ({
    promises: {
        access: jest.fn(),
        mkdir: jest.fn(),
        readFile: jest.fn(),
        writeFile: jest.fn(),
        unlink: jest.fn()
    }
}));

jest.mock('csv-parse', () => ({
    parse: jest.fn()
}));

describe('CsvService', () => {
    let csvService;
    
    beforeEach(() => {
        csvService = new CsvService('test.csv');
        jest.clearAllMocks();
    });

    describe('readExistingMovements', () => {
        it('should return empty array when file does not exist', async () => {
            fs.access.mockRejectedValue(new Error('File not found'));
            const result = await csvService.readExistingMovements();
            expect(result).toEqual([]);
        });

        it('should handle CSV parse errors', async () => {
            fs.access.mockResolvedValue(true);
            fs.readFile.mockResolvedValue('invalid,csv,data');
            csv.parse.mockImplementation((data, options, callback) => {
                callback(new Error('Parse error'), null);
            });
            const result = await csvService.readExistingMovements();
            expect(result).toEqual([]);
        });

        it('should parse valid CSV data correctly', async () => {
            fs.access.mockResolvedValue(true);
            fs.readFile.mockResolvedValue('valid,csv,data');
            const mockData = [{
                'Card Name': 'Test Card',
                'Old Board/List Name': 'List 1',
                'New Board/List Name': 'List 2',
                'Timestamp of Movement': '2024-03-14T12:00:00Z'
            }];
            csv.parse.mockImplementation((data, options, callback) => {
                callback(null, mockData);
            });

            const result = await csvService.readExistingMovements();
            expect(result).toEqual([{
                cardName: 'Test Card',
                oldLocation: 'List 1',
                newLocation: 'List 2',
                timestamp: '2024-03-14T12:00:00Z'
            }]);
        });

        it('should handle read file errors', async () => {
            fs.access.mockResolvedValue(true);
            fs.readFile.mockRejectedValue(new Error('Read error'));
            
            const result = await csvService.readExistingMovements();
            expect(result).toEqual([]);
        });
    });

    describe('writeMovements', () => {
        it('should handle empty movements array', async () => {
            await csvService.writeMovements([]);
            const csvWriter = require('csv-writer').createObjectCsvWriter;
            expect(csvWriter().writeRecords).not.toHaveBeenCalled();
        });

        it('should create directory if it doesn\'t exist', async () => {
            fs.access.mockRejectedValue(new Error('Directory not found'));
            
            const movements = [{
                cardName: 'Test Card',
                oldLocation: 'List 1',
                newLocation: 'List 2',
                timestamp: '2024-03-14T12:00:00Z'
            }];

            await csvService.writeMovements(movements);
            
            expect(fs.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
        });

        it('should handle invalid input types', async () => {
            await expect(csvService.writeMovements('not an array'))
                .rejects.toThrow('Movements must be an array');
            
            await expect(csvService.writeMovements(null))
                .rejects.toThrow('Movements must be an array');
        });

        it('should handle CSV writer initialization errors', async () => {
            const csvWriter = require('csv-writer').createObjectCsvWriter;
            csvWriter.mockImplementationOnce(() => {
                throw new Error('Writer initialization failed');
            });

            const movements = [{
                cardName: 'Test Card',
                oldLocation: 'List 1',
                newLocation: 'List 2',
                timestamp: '2024-03-14T12:00:00Z'
            }];

            await expect(csvService.writeMovements(movements))
                .rejects.toThrow('Writer initialization failed');
        });

        it('should deduplicate movements before writing', async () => {
            // Mock readExistingMovements to return empty array
            jest.spyOn(csvService, 'readExistingMovements').mockResolvedValue([]);
            
            const movements = [
                {
                    cardName: 'Test Card',
                    oldLocation: 'List 1',
                    newLocation: 'List 2',
                    timestamp: '2024-03-14T12:00:00Z'
                },
                {
                    cardName: 'Test Card',
                    oldLocation: 'List 1',
                    newLocation: 'List 2',
                    timestamp: '2024-03-14T12:00:00Z'
                }
            ];

            await csvService.writeMovements(movements);
            
            const csvWriter = require('csv-writer').createObjectCsvWriter;
            
            // First, verify the write was called with the correct data
            expect(csvWriter().writeRecords).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        cardName: 'Test Card',
                        oldLocation: 'List 1',
                        newLocation: 'List 2',
                        timestamp: '2024-03-14T12:00:00Z'
                    })
                ])
            );
            
            // Then verify only one record was written
            const writtenRecords = csvWriter().writeRecords.mock.calls[0][0];
            expect(writtenRecords).toHaveLength(1);
            expect(new Set(writtenRecords.map(JSON.stringify)).size).toBe(1);
        });
    });
});
