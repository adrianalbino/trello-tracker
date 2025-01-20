const fs = require('fs').promises;
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const csv = require('csv-parse');

/**
 * @typedef {Object} Movement
 * @property {string} cardName - Name of the card
 * @property {string} oldLocation - Previous location
 * @property {string} newLocation - New location
 * @property {string} timestamp - ISO timestamp
 */

class CsvService {
    /**
     * @param {string} outputPath - Path to CSV file
     * @param {Object} [options]
     * @param {boolean} [options.createDirectory=true] - Create directory if it doesn't exist
     */
    constructor(outputPath, options = {}) {
        this.outputPath = outputPath;
        this.createDirectory = options.createDirectory ?? true;
        this.headers = [
            { id: 'cardName', title: 'Card Name' },
            { id: 'oldLocation', title: 'Old Board/List Name' },
            { id: 'newLocation', title: 'New Board/List Name' },
            { id: 'timestamp', title: 'Timestamp of Movement' }
        ];
    }

    /**
     * Initialize CSV writer
     * @private
     * @param {boolean} [append=false] - Append to existing file
     */
    async initializeCsvWriter(append = false) {
        if (this.createDirectory) {
            const dir = path.dirname(this.outputPath);
            try {
                await fs.access(dir);
            } catch {
                await fs.mkdir(dir, { recursive: true });
            }
        }

        this.csvWriter = createObjectCsvWriter({
            path: this.outputPath,
            header: this.headers,
            append
        });
    }

    /**
     * Generate unique key for movement
     * @private
     * @param {Movement} movement
     * @returns {string}
     */
    static getMovementKey(movement) {
        return `${movement.cardName}-${movement.oldLocation}-${movement.newLocation}-${movement.timestamp}`;
    }

    /**
     * Read existing movements from CSV
     * @returns {Promise<Movement[]>}
     */
    async readExistingMovements() {
        try {
            const fileExists = await fs.access(this.outputPath)
                .then(() => true)
                .catch(() => false);

            if (!fileExists) return [];

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
                        return;
                    }

                    const movements = records.map(record => ({
                        cardName: record['Card Name'],
                        oldLocation: record['Old Board/List Name'],
                        newLocation: record['New Board/List Name'],
                        timestamp: record['Timestamp of Movement']
                    }));
                    resolve(movements);
                });
            });
        } catch (error) {
            console.error('Error reading existing CSV:', error);
            return [];
        }
    }

    /**
     * Write movements to CSV
     * @param {Movement[]} movements - New movements to write
     * @returns {Promise<void>}
     */
    async writeMovements(movements) {
        if (!Array.isArray(movements)) {
            throw new Error('Movements must be an array');
        }

        try {
            const existingMovements = await this.readExistingMovements();
            
            // First deduplicate the new movements array itself
            const uniqueNewMovements = Array.from(
                new Map(
                    movements.map(movement => [CsvService.getMovementKey(movement), movement])
                ).values()
            );

            // Then filter against existing movements
            const existingKeys = new Set(
                existingMovements.map(CsvService.getMovementKey)
            );

            const newMovements = uniqueNewMovements.filter(movement => 
                !existingKeys.has(CsvService.getMovementKey(movement))
            );

            if (newMovements.length === 0) {
                console.log('No new movements to write');
                return;
            }

            const allMovements = [...existingMovements, ...newMovements]
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            await this.initializeCsvWriter(false);
            await this.csvWriter.writeRecords(allMovements);
            
            console.log(`CSV file updated with ${newMovements.length} new records, all entries sorted chronologically`);
        } catch (error) {
            console.error('Error writing CSV:', error);
            throw error;
        }
    }
}

module.exports = CsvService;
