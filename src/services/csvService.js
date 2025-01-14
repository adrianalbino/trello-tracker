const createCsvWriter = require('csv-writer').createObjectCsvWriter;

class CsvService {
    constructor(outputPath) {
        this.csvWriter = createCsvWriter({
            path: outputPath,
            header: [
                { id: 'cardName', title: 'Card Name' },
                { id: 'oldLocation', title: 'Old Board/List Name' },
                { id: 'newLocation', title: 'New Board/List Name' },
                { id: 'timestamp', title: 'Timestamp of Movement' }
            ]
        });
    }

    async writeMovements(movements) {
        try {
            await this.csvWriter.writeRecords(movements);
            console.log('CSV file has been written successfully');
        } catch (error) {
            console.error('Error writing CSV:', error);
            throw error;
        }
    }
}

module.exports = CsvService;
