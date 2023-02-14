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
    EBCustomTransformationProcess = require('../components/architecture/EBCustomTransformationProcess'),
    EBPerformanceData = require('../../shared/models/EBPerformanceData'),
    EBPerformanceTrace = require('../../shared/components/EBPerformanceTrace'),
    EBRollingAverage = require("../../shared/models/EBRollingAverage"),
    EBStdioJSONStreamProcess = require("../components/EBStdioJSONStreamProcess"),
    fs = require('fs'),
    math = require('mathjs'),
    models = require("../../shared/models/models"),
    mongodb = require('mongodb'),
    path = require('path'),
    Promise = require('bluebird'),
    temp = require('temp'),
    underscore = require('underscore');

/**
 *  This task samples a data source and determines what the schema is, along with associatted metadata.
 */
class EBSampleDataSourceTask {
    /**
     * The constructor for the task object.
     *
     * @param {EBApplication} application This should be a reference to the root EBApplication object.
     */
    constructor(application)
    {
        this.application = application;
        this.socketio = application.socketio;
        this.dataSources = application.db.collection("EBDataSource");
        this.lastUpdateTime = null;
        this.frontendUpdateTime = 5000;
    }

    /**
     *  This is the entry point for the train model task.
     *
     *  @param {beaver.Task} task The Beaver task object
     *  @param {object} args The arguments for this task. It should only contain a single argument,
     *                       the MongoID of the EBModel object that needs to be trained.
     *  @return {Promise} A promise that will resolve with the finished EBModel object.
     */
    run(task, args)
    {
        this.task = task;

        return Promise.fromCallback((next) =>
        {
            // First log the start
            this.task.log(this.task, `Starting the task to sample the data source with _id: ${args._id}`, next);
        }).then(()=>
        {
            // Retrieve the data source object that this task refers to
            return this.dataSources.find({_id: args._id}).toArray();
        }).then((objects) =>
        {
            if (objects.length === 0)
            {
                return Promise.rejected(new Error("EBDataSource not found!"));
            }
            else
            {
                this.dataSource = new models.EBDataSource(objects[0]);
                return Promise.resolve();
            }
        }).then(() =>
        {
            return this.application.dataSourcePluginDispatch.detectSchema(this.dataSource, (schema, objectsCompleted, objectsTotal) =>
            {
                this.dataSource.objectsCompleted = objectsCompleted;
                this.dataSource.objectsTotal = objectsTotal;
                this.dataSource.isSampling = objectsCompleted < objectsTotal;
                schema.walk((field) =>
                {
                    field.setIncluded(true);
                });

                // Update the database and frontend if the last update time is greater then 5 seconds
                if (this.lastUpdateTime === null || (Date.now() - this.lastUpdateTime.getTime()) > this.frontendUpdateTime )
                {
                    this.lastUpdateTime = new Date();
                    return this.updateSchema(schema);
                }
                else
                {
                    return Promise.resolve(true);
                }
            });
        }).then((resultSchema) =>
        {
            resultSchema.walk((field) =>
            {
                field.setIncluded(true);
            });
            this.dataSource.isSampling = false;
            return this.updateSchema(resultSchema);
        }).then(() =>
        {
            return this.model;
        });
    }


    /**
     * This method is used to update the schema in the database. This method attempts to be careful not to override configuration
     * changes made by the user
     *
     * @param {EBSchema} newSchema The new schema object
     */
    updateSchema(newSchema)
    {
        // First retrieve the latest data source object from the database
        return this.dataSources.find({_id: this.dataSource._id}).toArray().then((objects) =>
        {
            const dataSource = new models.EBDataSource(objects[0]);

            if (dataSource.dataSchema)
            {
                // Copy the configuration from that schema into this one
                newSchema.copyConfigurationFrom(dataSource.dataSchema);
            }

            // Set local copy
            this.dataSource.dataSchema = newSchema;

            // Reset the interpretation configuration nom matter what
            this.dataSource.dataSchema.walk((field) =>
            {
                field.configuration.interpretation = this.application.interpretationRegistry.getInterpretation(field.metadata.mainInterpretation).generateDefaultConfiguration(field);
            });

            // Update in the database
            this.dataSources.update({_id: this.dataSource._id}, this.dataSource).then(() =>
            {
                // Trigger the frontend to be updated.
                this.socketio.to('general').emit(`data-source-${this.dataSource._id.toString()}`, {event: 'update'});
            });
        });
    }
}

module.exports = EBSampleDataSourceTask;
