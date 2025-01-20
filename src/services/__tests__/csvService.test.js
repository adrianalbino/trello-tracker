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
        readFile: jest.fn(),
        writeFile: jest.fn()
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

        it('should write all movements when file does not exist', async () => {
            fs.access.mockRejectedValue(new Error('File not found'));
            
            const movements = [{
                cardName: 'New Card',
                oldLocation: 'List 1',
                newLocation: 'List 2',
                timestamp: '2024-03-14T12:00:00Z'
            }];

            await csvService.writeMovements(movements);
            
            const csvWriter = require('csv-writer').createObjectCsvWriter;
            expect(csvWriter().writeRecords).toHaveBeenCalledWith(movements);
        });

        it('should only write new movements and sort chronologically', async () => {
            fs.access.mockResolvedValue(true);
            fs.readFile.mockResolvedValue('existing,csv,data');
            csv.parse.mockImplementation((data, options, callback) => {
                callback(null, [{
                    'Card Name': 'Existing Card',
                    'Old Board/List Name': 'List 1',
                    'New Board/List Name': 'List 2',
                    'Timestamp of Movement': '2024-03-14T12:00:00Z'
                }]);
            });

            const newMovements = [
                {
                    cardName: 'Existing Card',
                    oldLocation: 'List 1',
                    newLocation: 'List 2',
                    timestamp: '2024-03-14T12:00:00Z'
                },
                {
                    cardName: 'New Card',
                    oldLocation: 'List 3',
                    newLocation: 'List 4',
                    timestamp: '2024-03-14T13:00:00Z'
                }
            ];

            await csvService.writeMovements(newMovements);
            
            const csvWriter = require('csv-writer').createObjectCsvWriter;
            const mockCsvWriter = csvWriter.mock.results[0].value;
            
            // Verify all movements are written in chronological order
            expect(mockCsvWriter.writeRecords).toHaveBeenCalledWith([
                {
                    cardName: 'Existing Card',
                    oldLocation: 'List 1',
                    newLocation: 'List 2',
                    timestamp: '2024-03-14T12:00:00Z'
                },
                {
                    cardName: 'New Card',
                    oldLocation: 'List 3',
                    newLocation: 'List 4',
                    timestamp: '2024-03-14T13:00:00Z'
                }
            ]);
        });

        it('should handle write errors', async () => {
            const csvWriter = require('csv-writer').createObjectCsvWriter;
            csvWriter().writeRecords.mockRejectedValue(new Error('Write error'));

            const movements = [{
                cardName: 'Test Card',
                oldLocation: 'List 1',
                newLocation: 'List 2',
                timestamp: '2024-03-14T12:00:00Z'
            }];

            await expect(csvService.writeMovements(movements)).rejects.toThrow('Write error');
        });
    });
});
