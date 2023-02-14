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

const EBClassFactory = require("../components/EBClassFactory"),
    underscore = require('underscore');

const _mapping = Symbol("_mapping");
const _knownValues = Symbol("_knownValues");

/**
 *  EBConfusionChart is the equivalent of a confusion matrix but used when predicting a continuous value
 */
class EBConfusionChart
{
    /**
     * Creates an EBConfusionChart from the given raw data
     *
     * @param {object} rawConfusionChart The raw JSON data for this confusion matrix
     */
    constructor(rawConfusionChart)
    {
        const self = this;
        this.classType = 'EBConfusionChart';

        if (!rawConfusionChart)
        {
            rawConfusionChart = {};
        }

        if (rawConfusionChart.predictions)
        {
            self.predictions = rawConfusionChart.predictions;
        }
        else
        {
            self.predictions = [];
        }

        if (rawConfusionChart.historySize)
        {
            self.historySize = rawConfusionChart.historySize;
        }
        else
        {
            // Default size is 100
            self.historySize = 100;
        }
    }

    /**
     * Accumulates a result into the confusion matrix.
     */
    accumulateResult(expectedValue, actualValue)
    {
        const self = this;

        self.predictions.push({
            expectedValue: expectedValue,
            actualValue: actualValue
        });

        if (self.predictions.length > self.historySize)
        {
            self.predictions.splice(0, self.predictions.length - self.historySize);
        }
    }


    /**
     * Returns a JSON-Schema schema for EBNumberHistogram
     *
     * @returns {object} The JSON-Schema that can be used for validating this model object
     */
    static schema()
    {
        return {
            "id": "EBConfusionChart",
            "type": "object",
            "properties": {
                historySize: {type: "number"},
                predictions: {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            expectedValue: {"type": "number"},
                            actualValue: {"type": "number"}
                        }
                    }
                }
            }
        };
    }
}


EBClassFactory.registerClass('EBConfusionChart', EBConfusionChart, EBConfusionChart.schema());


module.exports = EBConfusionChart;
