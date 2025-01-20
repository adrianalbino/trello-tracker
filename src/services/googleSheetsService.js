const { google } = require('googleapis');
const path = require('path');

class GoogleSheetsService {
    constructor() {
        this.auth = null;
        this.sheets = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        const auth = new google.auth.GoogleAuth({
            keyFile: path.join(__dirname, '../../credentials.json'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        this.auth = await auth.getClient();
        this.sheets = google.sheets({ version: 'v4', auth: this.auth });
        this.initialized = true;
    }

    async readExistingMovements(spreadsheetId) {
        await this.initialize();

        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId,
                range: 'Sheet1!A:D'
            });

            const rows = response.data.values || [];
            if (rows.length <= 1) return []; // Empty or only headers

            // Skip header row and transform data
            return rows.slice(1).map(row => ({
                cardName: row[0],
                oldLocation: row[1],
                newLocation: row[2],
                timestamp: row[3]
            }));
        } catch (error) {
            console.error('Error reading from Google Sheet:', error);
            return [];
        }
    }

    async writeMovements(spreadsheetId, movements) {
        await this.initialize();

        try {
            // Get existing movements
            const existingMovements = await this.readExistingMovements(spreadsheetId);
            
            // Create unique keys for existing movements
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

                // Convert to row format
                const values = [
                    ['Card Name', 'Old Board/List Name', 'New Board/List Name', 'Timestamp of Movement'],
                    ...allMovements.map(movement => [
                        movement.cardName,
                        movement.oldLocation,
                        movement.newLocation,
                        movement.timestamp
                    ])
                ];

                // Clear existing content and write all data
                await this.sheets.spreadsheets.values.clear({
                    spreadsheetId,
                    range: 'Sheet1!A:D'
                });

                await this.sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: 'Sheet1!A1',
                    valueInputOption: 'RAW',
                    resource: { values }
                });

                console.log(`Google Sheet updated with ${newMovements.length} new records, all entries sorted chronologically`);
            } else {
                console.log('No new movements to write to Google Sheet');
            }
        } catch (error) {
            console.error('Error writing to Google Sheet:', error);
            throw error;
        }
    }
}

module.exports = GoogleSheetsService;
