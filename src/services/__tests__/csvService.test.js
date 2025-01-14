const CsvService = require('../csvService');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Mock csv-writer
jest.mock('csv-writer', () => ({
    createObjectCsvWriter: jest.fn()
}));

describe('CsvService', () => {
    let csvService;
    let mockWriteRecords;

    beforeEach(() => {
        mockWriteRecords = jest.fn().mockResolvedValue();
        createCsvWriter.mockReturnValue({
            writeRecords: mockWriteRecords
        });
        csvService = new CsvService('test.csv');
    });

    describe('writeMovements', () => {
        it('should write movements to CSV file successfully', async () => {
            const movements = [
                {
                    cardName: 'Test Card',
                    oldLocation: 'List 1',
                    newLocation: 'List 2',
                    timestamp: '2024-03-14T12:00:00Z'
                }
            ];

            await csvService.writeMovements(movements);

            expect(createCsvWriter).toHaveBeenCalledWith({
                path: 'test.csv',
                header: [
                    { id: 'cardName', title: 'Card Name' },
                    { id: 'oldLocation', title: 'Old Board/List Name' },
                    { id: 'newLocation', title: 'New Board/List Name' },
                    { id: 'timestamp', title: 'Timestamp of Movement' }
                ]
            });

            expect(mockWriteRecords).toHaveBeenCalledWith(movements);
        });

        it('should handle errors appropriately', async () => {
            const error = new Error('Write error');
            mockWriteRecords.mockRejectedValueOnce(error);

            await expect(csvService.writeMovements([])).rejects.toThrow('Write error');
        });
    });
});
