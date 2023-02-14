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
    fs = require('fs'),
    path = require('path'),
    Promise = require('bluebird'),
    ReadWriteLock = require('rwlock'),
    underscore = require('underscore');

/**
 * This class represents a sample of objects from a data source that have been split into a corresponding
 * testing and training set.
 */
class EBTrainingSet
{
    /**
     * Constructor for the EBTrainingSet object
     *
     * @param {EBApplicationBase} application The global application object
     * @param {EBDataSource} dataSource The data source which is being sampled.
     * @param {Number} testingSetPortion The amount of the dataset that goes into the testing set
     */
    constructor(application, dataSource, testingSetPortion)
    {
        this.application = application;
        this.dataSource = dataSource;

        this.trainingSetEntries = [];
        this.testingSetEntries = [];

        this.testingSetPosition = 0;
        this.trainingSetPosition = 0;

        this.testingSetPortion = testingSetPortion;
    }

    /**
     * This method samples the database, dividing the data into testing & training.
     *
     * @param {Number} count The maximum number of objects to sample
     * @param {function(count)} updateCallback The callback which will be called with intermediate results
     * @returns {Promise} A promise which resolves when sampling is complete
     */
    scanData(count, updateCallback)
    {
        const self = this;

        const trainingSetEntries = [];
        const testingSetEntries = [];

        let scannedObjects = 0;

        // Get a random sample of data from the data source.
        return self.application.dataSourcePluginDispatch.sample(count, this.dataSource, (object) =>
        {
            // Decide whether to put this entry into the training set
            // or the testing set.
            // First see how many entries we expect in each set
            const total = trainingSetEntries.length + testingSetEntries.length;
            const expectedTestingSetEntries = Math.ceil(self.testingSetPortion * total);
            const expectedTrainingSetEntries = Math.floor((1.0 - self.testingSetPortion) * total);

            // Compute the difference between the actual size and the expected size
            const testingDifference = expectedTestingSetEntries - testingSetEntries.length;
            const trainingDifference = expectedTrainingSetEntries - trainingSetEntries.length;

            // Which ever one is larger, we put the item in that group
            if (testingDifference < trainingDifference)
            {
                trainingSetEntries.push(object.id);
            }
            else
            {
                testingSetEntries.push(object.id);
            }

            scannedObjects += 1;

            if (updateCallback)
            {
                return updateCallback(scannedObjects);
            }
            else
            {
                return Promise.resolve(null);
            }
        }).then(() =>
        {
            // Shuffle the list of IDs so that they are in a random order
            this.trainingSetEntries = underscore.shuffle(trainingSetEntries);
            this.testingSetEntries = underscore.shuffle(testingSetEntries);
        });
    }


    /**
     * This method returns the very next object ID for the training set
     *
     * @returns {string} An object ID
     */
    nextTrainingID()
    {
        const id = this.trainingSetEntries[this.trainingSetPosition];
        this.trainingSetPosition = (this.trainingSetPosition + 1) % this.trainingSetEntries.length;
        return id;
    }


    /**
     * This method returns the very next object ID for the testing set
     *
     * @returns {string} An object ID
     */
    nextTestingID()
    {
        const id = this.testingSetEntries[this.testingSetPosition];
        this.testingSetPosition = (this.testingSetPosition + 1) % this.testingSetEntries.length;
        return id;
    }
}

module.exports = EBTrainingSet;
