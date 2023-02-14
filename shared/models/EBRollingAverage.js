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

const underscore = require('underscore'),
    EBClassFactory = require("../components/EBClassFactory");

/**
 *  EBRollingAverage is a simple tool that keeps track of a rolling average over some time scale.
 *
 *  The method used is an exponential rolling average, in order to minimize the storage costs.
 */
class EBRollingAverage
{
    /**
     * Creates a EBRollingAverage object.
     *
     * @param {object} rawRollingAverage Creates a rolling average object from the given raw json data
     */
    constructor(rawRollingAverage)
    {
        const self = this;
        
        self.type = 'EBRollingAverage';

        self.period = rawRollingAverage.period;
        self.value = rawRollingAverage.value;
        self.count = rawRollingAverage.count;
    }

    /**
     * This method creates a new rolling average with the given period.
     *
     * @param {number} period The number of values that need to be accumulated in order to roll over
     *                        the average.`
     */
    static createWithPeriod(period)
    {
        return new EBRollingAverage({
            period: period,
            value: 0,
            count: 0
        });
    }

    /**
     * Accumulates another value
     */
    accumulate(value)
    {
        const self = this;
        self.count = Math.min(self.count + 1, self.period);
        const ratio = 1 / self.count;
        self.value = self.value * (1.0 - ratio) + value * ratio;
    }

    /**
     * Get the current average value
     */
    get average()
    {
        return this.value;
    }


    /**
     * Returns a JSON-Schema schema for EBRollingAverage
     *
     * @returns {object} The JSON-Schema that can be used for validating a rolling average object.
     */
    static schema()
    {
        return {
            "id": "EBRollingAverage",
            "type": "object",
            "properties": {
                period: {"type": "number"},
                value: {"type": "number"},
                count: {"type": "number"}
            }
        };
    }
}

EBClassFactory.registerClass('EBRollingAverage', EBRollingAverage, EBRollingAverage.schema());

module.exports = EBRollingAverage;
