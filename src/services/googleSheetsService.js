const { google } = require('googleapis');
const path = require('path');

/**
 * @typedef {import('./csvService').Movement} Movement
 */

class GoogleSheetsService {
    /**
     * @param {Object} [options]
     * @param {string} [options.credentialsPath] - Path to credentials file
     * @param {string[]} [options.scopes] - OAuth2 scopes
     */
    constructor(options = {}) {
        this.credentialsPath = options.credentialsPath || 
            path.join(__dirname, '../../credentials.json');
        this.scopes = options.scopes || 
            ['https://www.googleapis.com/auth/spreadsheets'];
        this.auth = null;
        this.sheets = null;
        this.initialized = false;
    }

    /**
     * Initialize Google Sheets API
     * @private
     */
    async initialize() {
        if (this.initialized) return;

        try {
            const auth = new google.auth.GoogleAuth({
                keyFile: this.credentialsPath,
                scopes: this.scopes
            });

            this.auth = await auth.getClient();
            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize Google Sheets:', error);
            throw new Error('Google Sheets initialization failed');
        }
    }

    /**
     * Read existing movements from sheet
     * @param {string} spreadsheetId - Google Sheet ID
     * @returns {Promise<Movement[]>}
     */
    async readExistingMovements(spreadsheetId) {
        await this.initialize();

        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId,
                range: 'Sheet1!A:D'
            });

            const rows = response.data.values || [];
            if (rows.length <= 1) return [];

            return rows.slice(1).map(row => ({
                cardName: row[0] || '',
                oldLocation: row[1] || '',
                newLocation: row[2] || '',
                timestamp: row[3] || ''
            }));
        } catch (error) {
            console.error('Error reading from Google Sheet:', error);
            throw new Error(`Failed to read from Google Sheet: ${error.message}`);
        }
    }

    /**
     * Write movements to Google Sheet
     * @param {string} spreadsheetId - Google Sheet ID
     * @param {Movement[]} movements - Movements to write
     */
    async writeMovements(spreadsheetId, movements) {
        if (!spreadsheetId) {
            throw new Error('Spreadsheet ID is required');
        }

        if (!Array.isArray(movements)) {
            throw new Error('Movements must be an array');
        }

        await this.initialize();

        try {
            const existingMovements = await this.readExistingMovements(spreadsheetId);
            const existingKeys = new Set(
                existingMovements.map(m => 
                    `${m.cardName}-${m.oldLocation}-${m.newLocation}-${m.timestamp}`
                )
            );

            const newMovements = movements.filter(movement => 
                !existingKeys.has(
                    `${movement.cardName}-${movement.oldLocation}-${movement.newLocation}-${movement.timestamp}`
                )
            );

            if (newMovements.length === 0) {
                console.log('No new movements to write to Google Sheet');
                return;
            }

            const allMovements = [...existingMovements, ...newMovements]
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            const values = [
                ['Card Name', 'Old Board/List Name', 'New Board/List Name', 'Timestamp of Movement'],
                ...allMovements.map(movement => [
                    movement.cardName,
                    movement.oldLocation,
                    movement.newLocation,
                    movement.timestamp
                ])
            ];

            await this.clearAndWriteSheet(spreadsheetId, values);
            
            console.log(`Google Sheet updated with ${newMovements.length} new records`);
        } catch (error) {
            console.error('Error writing to Google Sheet:', error);
            throw new Error(`Failed to write to Google Sheet: ${error.message}`);
        }
    }

    /**
     * Clear and write new values to sheet
     * @private
     * @param {string} spreadsheetId - Google Sheet ID
     * @param {Array<Array<string>>} values - Values to write
     */
    async clearAndWriteSheet(spreadsheetId, values) {
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
    }
}

module.exports = GoogleSheetsService;
