const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs').promises;
const csv = require('csv-parse');

class CsvService {
    constructor(outputPath) {
        this.outputPath = outputPath;
    }

    async initializeCsvWriter(append = false) {
        this.csvWriter = createCsvWriter({
            path: this.outputPath,
            header: [
                { id: 'cardName', title: 'Card Name' },
                { id: 'oldLocation', title: 'Old Board/List Name' },
                { id: 'newLocation', title: 'New Board/List Name' },
                { id: 'timestamp', title: 'Timestamp of Movement' }
            ],
            append: append
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
            return new Promise((resolve) => {
                csv.parse(content, {
                    columns: true,
                    skip_empty_lines: true,
                    trim: true
                }, (err, records) => {
                    if (err) {
                        console.error('Error parsing CSV:', err);
                        resolve([]);
                    } else {
                        // Transform the records to match our expected format
                        const movements = records.map(record => ({
                            cardName: record['Card Name'],
                            oldLocation: record['Old Board/List Name'],
                            newLocation: record['New Board/List Name'],
                            timestamp: record['Timestamp of Movement']
                        }));
                        resolve(movements);
                    }
                });
            });
        } catch (error) {
            console.error('Error reading existing CSV:', error);
            return [];
        }
    }

    async writeMovements(movements) {
        try {
            const fileExists = await fs.access(this.outputPath)
                .then(() => true)
                .catch(() => false);

            // Initialize CSV writer with appropriate append flag
            await this.initializeCsvWriter(fileExists);

            const existingMovements = await this.readExistingMovements();
            const existingKeys = new Set(
                existingMovements.map(m => 
                    `${m.cardName}-${m.oldLocation}-${m.newLocation}-${m.timestamp}`
                )
            );

            // Filter out duplicates
            const newMovements = movements.filter(movement => 
                !existingKeys.has(
                    `${movement.cardName}-${movement.oldLocation}-${movement.newLocation}-${movement.timestamp}`
                )
            );

            if (newMovements.length > 0) {
                // Sort all movements chronologically
                const allMovements = [...existingMovements, ...newMovements].sort((a, b) => 
                    new Date(a.timestamp) - new Date(b.timestamp)
                );
                
                await this.initializeCsvWriter(false);
                await this.csvWriter.writeRecords(allMovements);
                console.log(`CSV file updated with ${newMovements.length} new records, all entries sorted chronologically`);
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
