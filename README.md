
# Trello Card Movement Tracker
by Adrian Albino

A Node.js application that tracks card movements across Trello boards and lists, with support for caching, CSV export, and Google Sheets integration.

## Features

- Track card movements across Trello boards
- Cache API responses to reduce API calls
- Export data to CSV files, incremental additions of new data
- Sync data with Google Sheets
- Support for background refresh of stale data


## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
``` 
3. Create a `.env` file in the root directory with your Trello credentials:
```bash
TRELLO_API_KEY=your_api_key
TRELLO_TOKEN=your_token
```
4. (Optional) For Google Sheets integration, place your `credentials.json` file in the root directory. To get your credentials follow the tutorial in https://developers.google.com/workspace/guides/create-credentials

## Cache System

The application implements caching system to minimize API calls to Trello. Here's how it works:

- Cache Duration: 24 hours (configurable)
- Stale After: 1 hour (configurable)
- Location: `.cache` directory (configurable)

The cache system provides three key behaviors:

1. **Fresh Data**: Returns cached data if it's less than 1 hour old
2. **Stale Data**: Returns cached data but triggers a background refresh if data is between 1-24 hours old
3. **Expired Data**: Fetches new data if cache is older than 24 hours

## Usage

### Basic Usage

To fetch list of boards available from API:
```bash
npm start
```

To fetch card movements from a specific board and generate CSV file (if it doesn't exist yet) and Google Sheets integration (checks cache first). Spreadsheet ID is optional, if not provided, only CSV file will be generated. Extract board-id and sheets-id from their respective URLs:

trello board-id: `https://trello.com/b/<board-id>/<board-name>`

spreadsheet-id: `https://docs.google.com/spreadsheets/d/<spreadsheet-id>/edit?gid=<sheet-id>#gid=<sheet-id>`

```bash
npm start -- <board-id> <spreadsheet-id>
```


To get FRESH data and force to bypass cache:
```bash
npm start -- <board-id> <spreadsheet-id> --force
```


## Output

The application generates two types of output:

1. **CSV File**: `card_movements.csv` in the root directory
2. **Google Sheets**: Updates the specified spreadsheet (if provided)

Both outputs include:
- Card Name
- Previous List/Board
- New List/Board
- Timestamp of Movement

## Testing
Run the test suites with:
```bash
npm test
```