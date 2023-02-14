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

/**
 * This represents a histogram showing the most common values for a particular field.
 */
class EBValueHistogram
{
    /**
     * This constructs an EBValueHistogram object from the given raw JSON data.
     *
     * @param {object} rawHistogram The raw JSON data describing the histogram
     */
    constructor(rawHistogram)
    {
        const self = this;
        
        if (!rawHistogram)
        {
            rawHistogram = {};
        }

        if (rawHistogram.values)
        {
            self.values = rawHistogram.values;
        }
        else
        {
            self.values = [];
        }

        if (rawHistogram.cardinality)
        {
            self.cardinality = rawHistogram.cardinality;
        }
        else
        {
            self.cardinality = null;
        }
    }

    /**
     * This function will compute the value histogram from the given set of values
     *
     * @param {[value]} values The list of values to compute the histogram for
     * @returns {EBValueHistogram} The resulting histogram
     */
    static computeHistogram(values)
    {
        const counts = {};
        values.forEach(function(value)
        {
            if (!counts[String(value)])
            {
                counts[String(value)] = 1;
            }
            else
            {
                counts[String(value)] += 1;
            }
        });

        const histogram = {values: []};
        Object.keys(counts).forEach(function(value)
        {
            histogram.values.push({
                value: value,
                frequency: counts[value]
            });
        });

        histogram.values = underscore.sortBy(histogram.values, (item) => -item.frequency);
        histogram.cardinality = histogram.values.length / values.length;

        return new EBValueHistogram(histogram);
    }

    /**
     * Returns a JSON-Schema schema for EBValueHistogram
     *
     * @returns {object} The JSON-Schema that can be used for validating this model object
     */
    static schema()
    {
        return {
            "id": "EBValueHistogram",
            "type": "object",
            "properties": {
                "values": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            value: {},
                            frequency: {"type": "number"}
                        }
                    }
                }
            }
        };
    }
}

EBClassFactory.registerClass('EBValueHistogram', EBValueHistogram, EBValueHistogram.schema());

module.exports = EBValueHistogram;
