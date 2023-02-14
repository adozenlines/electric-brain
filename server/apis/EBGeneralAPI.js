/*
 Electric Brain is an easy to use platform for machine learning.
 Copyright (C) 2016 Electric Brain Software Corporation

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.

 You should have received a copy of the GNU Affero General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

const Ajv = require('ajv'),
    async = require('async'),
    childProcess = require("child_process"),
    EBAPIRoot = require('./EBAPIRoot'),
    fs = require('fs'),
    idUtilities = require("../utilities/id"),
    models = require('../../shared/models/models'),
    mongodb = require('mongodb'),
    tasks = require("../tasks/tasks"),
    path = require('path'),
    schemaUtilities = require("../models/schema_utilities"),
    underscore = require('underscore');

/**
 * This handles the home endpoint and a few other miscellaneous routes.
 */
class EBGeneralAPI extends EBAPIRoot
{
    /**
     * Creates a new EBGeneralAPI
     *
     * @param {object} application The top level EBApplication object
     */
    constructor(application)
    {
        super(application);
        this.application = application;

        // Fetch the hostname
        this.hostname = childProcess.execSync("hostname").toString().trim();

        // Set the start time
        this.startTime = new Date();

        // Get package data
        this.packageData = require('../../package.json');

        this.license = fs.readFileSync(this.application.config.get('licenseFile')).toString();
    }

    /**
     * Registers all of the endpoints with the express application
     *
     * @param {object} expressApplication This is an express application object.
     */
    setupEndpoints(expressApplication)
    {
        this.registerEndpoint(expressApplication, {
            "name": "GetHomeData",
            "uri": "/",
            "method": "GET",
            "inputSchema": {},
            "outputSchema": {},
            "handler": this.getHomeData.bind(this)
        });
    }


    /**
     * This endpoint is used to return general information about the Electric Brain API server, such as configuration
     * information that needs to be communicated to the frontend
     *
     * @param {object} req express request object
     * @param {object} res express response object
     * @param {function} next express callback
     */
    getHomeData(req, res, next)
    {
        return next(null, {
            name: "Electric Brain API Server",
            hostname: this.hostname,
            version: this.packageData.version,
            start: this.startTime.toISOString(),
            companyName: this.application.config.get('companyName'),
            softwareName: this.application.config.get('softwareName'),
            license: this.license,
            logo: this.application.config.get('logoFile')
        });
    }


}


module.exports = EBGeneralAPI;

