const TrelloService = require('./services/trelloService');
const CsvService = require('./services/csvService');
const GoogleSheetsService = require('./services/googleSheetsService');

async function main() {
    try {
        const trelloService = new TrelloService();
        const csvService = new CsvService('card_movements.csv');
        const sheetsService = new GoogleSheetsService();

        // Get all boards
        const boards = await trelloService.getBoards();
        console.log('Available boards:', boards);

        // If board ID is provided as argument, use it
        const boardId = process.argv[2];
        const spreadsheetId = process.argv[3]; // Add spreadsheet ID as command line argument

        if (!boardId) {
            console.log('Please provide a board ID as an argument');
            return;
        }

        // Get board actions
        const actions = await trelloService.getBoardActions(boardId);
        
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
            await sheetsService.updateOrAppendMovements(spreadsheetId, movements);
        }

    } catch (error) {
        console.error('Application error:', error);
        process.exit(1);
    }
}

main();
