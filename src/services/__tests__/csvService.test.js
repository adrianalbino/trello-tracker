const CsvService = require('../csvService');
const fs = require('fs').promises;
const csv = require('csv-parse');

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

    describe('writeMovements', () => {
        it('should only write new movements', async () => {
            // Mock existing data
            fs.access.mockResolvedValue(true);
            fs.readFile.mockResolvedValue('existing,csv,data');
            csv.parse.mockImplementation((data, options, callback) => {
                callback(null, [
                    {
                        cardName: 'Existing Card',
                        timestamp: '2024-03-14T12:00:00Z'
                    }
                ]);
            });

            const newMovements = [
                {
                    cardName: 'Existing Card',
                    timestamp: '2024-03-14T12:00:00Z'
                },
                {
                    cardName: 'New Card',
                    timestamp: '2024-03-14T13:00:00Z'
                }
            ];

            await csvService.writeMovements(newMovements);
            
            // Verify only new movement was written
            expect(csvService.csvWriter.writeRecords)
                .toHaveBeenCalledWith([newMovements[1]]);
        });
    });
});
