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

const testingData = require('../test/utilities/testing_data');

/**
 *  This script is used to quickly generate data for a bunch of different tests.
 *
 *  @param {function(err)} next Callback after all the testing data has been generated.
 */
module.exports.generateData = function generateData(next)
{
    testingData.generateCopyTestingDataSet().then(() =>
    {
        return testingData.generateDualCopyTestingDataSet();
    }).then(() =>
    {
        return testingData.generateSequenceCopyTestingDataSet();
    }).then(() =>
    {
        return testingData.generateDateClassificationDataset();
    }).then(() =>
    {
        return testingData.generateSequenceDualCopyTestingDataSet();
    }).then(() =>
    {
        return testingData.generateSequenceIdentificationTestingDataSet();
    }).then(() =>
    {
        return testingData.generateSequenceClassificationTestingDataSet();
    }).then(() =>
    {
        return testingData.generateLayeredSequenceCopyTestingDataSet();
    }).then(() =>
    {
        return testingData.generateLayeredSequenceIdentificationTestingDataSet();
    }).then(() =>
    {
        return testingData.generateLayeredSequenceClassificationTestingDataSet();
    }).then(() =>
    {
        return testingData.generateInnerSequenceClassificationTestingDataSet();
    }).then(() =>
    {
        return testingData.generateNumberHistogramDataset();
    }).then(() =>
    {
        return testingData.generateStringIdentificationSequence();
    }).then(() =>
    {
        return testingData.generateNumberPredictionFromClassificationDataset();
    }).then(() =>
    {
        return testingData.generateMatchingTestDataset();
    }).then(() => next(), (err) => next(err));
};

if (require.main === module)
{
    module.exports.generateData(function(err)
    {
        if (err)
        {
            throw err;
        }
        else
        {
            process.exit(0);
        }
    });
}
