#!/usr/bin/env node

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
    EBApplication = require("../../../server/EBApplication"),
    EBTrainMatchingModelWorker = require("../server/EBTrainMatchingModelWorker");

/**
 * This script starts the an electric brain worker
 *
 * @param {function(err)} done callback after the server has started
 *
 */
module.exports = function main(done)
{
    const application = new EBApplication();

    async.series([
        application.initializeDatabase.bind(application),
        application.initializeBackgroundTask.bind(application)
    ], (err) =>
    {
        if (err)
        {
            return done(err);
        }
        else
        {
            const worker = new EBTrainMatchingModelWorker(application);
            worker.run().then(() => done(null), (err) => done(err));
        }
    });
};


if (require.main === module)
{
    module.exports((err) =>
    {
        if (err)
        {
            throw err;
        }
    });
}
