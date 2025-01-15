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

    async appendMovements(spreadsheetId, movements) {
        await this.initialize();

        const values = movements.map(movement => [
            movement.cardName,
            movement.oldLocation,
            movement.newLocation,
            movement.timestamp
        ]);

        try {
            await this.sheets.spreadsheets.values.append({
                spreadsheetId,
                range: 'Sheet1!A:D',
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values
                }
            });

            console.log('Data successfully appended to Google Sheet');
        } catch (error) {
            console.error('Error appending to Google Sheet:', error);
            throw error;
        }
    }

    async updateOrAppendMovements(spreadsheetId, movements) {
        await this.initialize();

        try {
            // First, get existing data
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId,
                range: 'Sheet1!A:D'
            });

            const existingData = response.data.values || [];
            const existingCards = new Set(existingData.map(row => row[0]));

            // Separate new and existing movements
            const newMovements = [];
            const updateMovements = [];

            movements.forEach(movement => {
                if (existingCards.has(movement.cardName)) {
                    updateMovements.push(movement);
                } else {
                    newMovements.push(movement);
                }
            });

            // Handle updates
            if (updateMovements.length > 0) {
                for (const movement of updateMovements) {
                    const rowIndex = existingData.findIndex(row => row[0] === movement.cardName);
                    if (rowIndex !== -1) {
                        await this.sheets.spreadsheets.values.update({
                            spreadsheetId,
                            range: `Sheet1!A${rowIndex + 1}:D${rowIndex + 1}`,
                            valueInputOption: 'RAW',
                            resource: {
                                values: [[
                                    movement.cardName,
                                    movement.oldLocation,
                                    movement.newLocation,
                                    movement.timestamp
                                ]]
                            }
                        });
                    }
                }
            }

            // Handle new entries
            if (newMovements.length > 0) {
                await this.appendMovements(spreadsheetId, newMovements);
            }

            console.log('Data successfully updated in Google Sheet');
        } catch (error) {
            console.error('Error updating Google Sheet:', error);
            throw error;
        }
    }
}

module.exports = GoogleSheetsService;
