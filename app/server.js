const express = require('express');
const favicon = require('serve-favicon');
const path = require('path');
require('dotenv').config();
const { listenForMessages } = require('./listenForMessages');

const app = express();

// Middleware pour parser les données de formulaire POST (URL-encoded)
app.use(express.urlencoded({ extended: true }));

// public assets
app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(path.join(__dirname, 'public/images', 'favicon.ico')));
app.use('/coverage', express.static(path.join(__dirname, '..', 'coverage')));

// ejs for view templates
app.engine('.html', require('ejs').__express);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');

// load route
require('./route')(app);

const subscriptionNameOrId = 'dmii2-9';
const timeout = 60;

console.log('Demarrage du serveur avec le listenner !');
listenForMessages(subscriptionNameOrId, timeout);

// server
const port = process.env.PORT || 3000;
app.server = app.listen(port);
console.log(`listening on port ${port}`);

module.exports = app;
