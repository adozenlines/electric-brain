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

const EBRollingAverage = require('./EBRollingAverage'),
    EBClassFactory = require("../components/EBClassFactory");

/**
 * EBPerformanceData is a class that can be used for recording the performance of various steps within a system
 * in Electric Brain.
 */
class EBPerformanceData
{
    /**
     * This constructs an EBPerformanceData object from the given raw JSON data.
     *
     * @param {object} rawPerformanceData The raw JSON data containing the performance data
     */
    constructor(rawPerformanceData)
    {
        this.classType = 'EBPerformanceData';
        
        if (!rawPerformanceData)
        {
            this.traceAverages = {};
        }
        else
        {
            this.traceAverages = rawPerformanceData.traceAverages;
        }
    }

    /**
     * This method takes an EBPerformanceTrace object and accumulates its data into the averages
     * contained within this object.
     *
     * @param {EBPerformanceTrace} traceObject A trace object to accumulate into this performance data.
     */
    accumulate(traceObject)
    {
        traceObject.traces.forEach((trace, index) =>
        {
            if (index > 0)
            {
                const lastTrace = traceObject.traces[index - 1];
                const time = trace.time.getTime() - lastTrace.time.getTime();

                if (!this.traceAverages[trace.name])
                {
                    this.traceAverages[trace.name] = EBRollingAverage.createWithPeriod(1000);
                }
                this.traceAverages[trace.name].accumulate(time);
            }
        });
    }

    /**
     * This method returns the current average total for all steps being recorded in this performance
     * data
     *
     * @returns {number}
     */
    total()
    {
        let total = 0;
        Object.keys(this.traceAverages).forEach((key) =>
        {
            total += this.traceAverages[key].value;
        });
        return total;
    }

    /**
     * Returns a JSON-Schema schema for EBPerformanceData
     *
     * @returns {object} The JSON-Schema that can be used for validating query object
     */
    static schema()
    {
        return {
            "id": "EBPerformanceData",
            "type": "object",
            "properties": {
                traceAverages: {
                    "type": "object",
                    "additionalProperties": EBRollingAverage.schema()
                }
            }
        };
    }
}

EBClassFactory.registerClass('EBPerformanceData', EBPerformanceData, EBPerformanceData.schema());

module.exports = EBPerformanceData;
