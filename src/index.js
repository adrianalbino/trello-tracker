const TrelloService = require('./services/trelloService');
const CsvService = require('./services/csvService');
const GoogleSheetsService = require('./services/googleSheetsService');

async function main() {
    try {
        const trelloService = new TrelloService();
        const csvService = new CsvService('card_movements.csv');
        const sheetsService = new GoogleSheetsService();

        // Get all command line arguments
        const args = process.argv.slice(2);
        const forceFresh = args.includes('--fresh');

        const nonFlagArgs = args.filter(arg => !arg.startsWith('--'));
        const boardId = nonFlagArgs[0];
        const spreadsheetId = nonFlagArgs[1];

        if (!boardId) {
            console.log('Please provide a board ID as an argument');
            return;
        }

        // Get all boards
        const boards = await trelloService.getBoards(forceFresh);
        console.log('Available boards:', boards);

        // Get board actions
        const actions = await trelloService.getBoardActions(boardId, forceFresh);
        
        // Format actions
        const movements = actions.map(action => ({
            cardName: action.data.card.name,
            oldLocation: action.data.listBefore ? action.data.listBefore.name : 'N/A',
            newLocation: action.data.listAfter ? action.data.listAfter.name : 'N/A',
            timestamp: new Date(action.date).toISOString()
        }));

        // Write to CSV
        await csvService.writeMovements(movements);

        // If spreadsheet ID is provided, also write to Google Sheets
        if (spreadsheetId) {
            await sheetsService.writeMovements(spreadsheetId, movements);
        }

    } catch (error) {
        console.error('Application error:', error);
        process.exit(1);
    }
}

main();
