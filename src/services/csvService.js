const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs').promises;
const csv = require('csv-parse');

class CsvService {
    constructor(outputPath) {
        this.outputPath = outputPath;
        this.csvWriter = createCsvWriter({
            path: outputPath,
            header: [
                { id: 'cardName', title: 'Card Name' },
                { id: 'oldLocation', title: 'Old Board/List Name' },
                { id: 'newLocation', title: 'New Board/List Name' },
                { id: 'timestamp', title: 'Timestamp of Movement' }
            ],
            append: true
        });
    }

    async readExistingMovements() {
        try {
            const fileExists = await fs.access(this.outputPath)
                .then(() => true)
                .catch(() => false);

            if (!fileExists) {
                return [];
            }

            const content = await fs.readFile(this.outputPath, 'utf-8');
            return new Promise((resolve, reject) => {
                csv.parse(content, {
                    columns: true,
                    skip_empty_lines: true
                }, (err, records) => {
                    if (err) reject(err);
                    else resolve(records);
                });
            });
        } catch (error) {
            console.error('Error reading existing CSV:', error);
            return [];
        }
    }

    async writeMovements(movements) {
        try {
            const existingMovements = await this.readExistingMovements();
            const existingKeys = new Set(
                existingMovements.map(m => `${m.cardName}-${m.timestamp}`)
            );

            // Filter out duplicates
            const newMovements = movements.filter(movement => 
                !existingKeys.has(`${movement.cardName}-${movement.timestamp}`)
            );

            if (newMovements.length > 0) {
                // Sort all movements chronologically
                const allMovements = [...existingMovements, ...newMovements].sort(
                    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
                );
                
                // Write all movements to CSV
                await this.csvWriter.writeRecords(allMovements);
                console.log(`CSV file updated with ${newMovements.length} new records`);
            } else {
                console.log('No new movements to write');
            }
        } catch (error) {
            console.error('Error writing CSV:', error);
            throw error;
        }
    }
}

module.exports = CsvService;
