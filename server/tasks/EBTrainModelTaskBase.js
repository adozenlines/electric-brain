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

const
    async = require('async'),
    EBPerformanceData = require('../../shared/models/EBPerformanceData'),
    EBPerformanceTrace = require('../../shared/components/EBPerformanceTrace'),
    EBRollingAverage = require("../../shared/models/EBRollingAverage"),
    EBStdioJSONStreamProcess = require("../../server/components/EBStdioJSONStreamProcess"),
    EBTrainingSet = require("../../server/components/model/EBTrainingSet"),
    fs = require('fs'),
    models = require("../../shared/models/models"),
    mongodb = require('mongodb'),
    path = require('path'),
    Promise = require('bluebird'),
    temp = require('temp'),
    underscore = require('underscore'),
    socketioClient = require('socket.io-client');

/**
 *  A base class for various classes which train models
 */
class EBTrainModelTaskBase
{
    /**
     * The constructor for the task object.
     *
     * @param {EBApplicationBase} application This should be a reference to the root EBApplication object.
     */
    constructor(application)
    {
        this.application = application;
        this.socketio = application.socketio;
        this.models = application.db.collection("EBModel");
        this.gridFS = new mongodb.GridFSBucket(application.db, {
            chunkSizeBytes: 1024,
            bucketName: 'EBModel.torch'
        });
        
        
        this.lastFrontendUpdateTime = null;
        this.lastDatabaseUpdateTime = null;
        this.isFrontendUpdateScheduled = null;
        this.isDatabaseUpdateScheduled = null;
        this.needAnotherDatabaseUpdate = false;
        this.frontendUpdateInterval = 2500;
        this.databaseUpdateInterval = 5000;
    }

    /**
     * This function sets up the cancellation handler with the given model
     *
     * @param {EBModel} model The model object being processed by this task. This is needed in order to ensure that we don't respond to cancellation events for other models
     * @param {function()} cancelCallback The function that should be called if the task needs to be cancelled
     */
    setupCancellationCallback(model, cancelCallback)
    {
        this.socketClient = socketioClient.connect('http://localhost:3891/', {reconnect: true});
        this.socketClient.on(`command-model-${model._id}`, (data) =>
        {
            if (data.command === 'kill')
            {
                cancelCallback();
            }
        });
    }

    /**
     * This function updates the current results for a given step
     *
     * @param {string} stepName The name of the step being updated. Should be the same as the the field names in EBModel
     * @param {object} result An object with the results
     * @return {Promise} Resolves a promise after the process is started and ready to receive commands
     */
    updateStepResult(stepName, result)
    {
        const self = this;

        // First, set the value on the model object
        self.model[stepName] = result;

        return Promise.fromCallback((callback) =>
        {
            // Scheduling to send updates to the frontend
            if (!self.isFrontendUpdateScheduled)
            {
                self.isFrontendUpdateScheduled = true;
                let frontendUpdateDelay = 0;
                if (self.lastFrontendUpdateTime)
                {
                    frontendUpdateDelay = Math.max(0, self.frontendUpdateInterval - (Date.now() - self.lastFrontendUpdateTime.getTime()));
                }

                const updateFrontend = function updateFrontend()
                {
                    self.isFrontendUpdateScheduled = false;
                    self.lastFrontendUpdateTime = new Date();

                    self.socketio.to('general').emit(`model-${self.model._id.toString()}`, {
                        event: 'update',
                        model: self.model
                    });
                };

                setTimeout(updateFrontend, frontendUpdateDelay);
            }

            // Scheduling to send updates to the database
            if (!self.isDatabaseUpdateScheduled)
            {
                self.isDatabaseUpdateScheduled = true;

                const updateDatabase = function updateDatabase()
                {
                    self.isDatabaseUpdateScheduled = true;
                    self.lastDatabaseUpdateTime = new Date();

                    self.models.updateOne({_id: self.model._id}, self.model, (err) =>
                    {
                        if (err)
                        {
                            console.error(err);
                        }

                        self.isDatabaseUpdateScheduled = false;
                        if (self.needAnotherDatabaseUpdate)
                        {
                            self.needAnotherDatabaseUpdate = false;
                            updateDatabase();
                        }
                    });
                };

                let databaseUpdateDelay = 0;
                if (self.lastDatabaseUpdateTime)
                {
                    databaseUpdateDelay = Math.max(0, self.databaseUpdateInterval - (Date.now() - self.lastDatabaseUpdateTime.getTime()));
                }
                setTimeout(updateDatabase, databaseUpdateDelay);
            }
            else
            {
                self.needAnotherDatabaseUpdate = true;
            }

            return callback();
        });
    }

}

module.exports = EBTrainModelTaskBase;
