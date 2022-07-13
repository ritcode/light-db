'use strict';

const Database = require('./src/Database');

function LightDB(config) { return new Database(config); }

LightDB.Collection = require('./src/Collection');
LightDB.Database = Database;

module.exports = LightDB;
