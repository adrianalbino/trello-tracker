require('dotenv').config();

const config = {
    trello: {
        apiKey: process.env.TRELLO_API_KEY,
        token: process.env.TRELLO_TOKEN
    }
};

module.exports = config;
