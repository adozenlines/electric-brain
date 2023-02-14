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

const EBClassFactory = require("../components/EBClassFactory");

/**
 * This represents a custom database query
 */
class EBCustomQuery
{
    /**
     * This constructs an EBCustomQuery object from the given raw JSON data.
     *
     * @param {object} rawCustomQuery The raw JSON data describing the histogram
     */
    constructor(rawCustomQuery)
    {
        const self = this;
        
        this.classType = "EBCustomQuery";

        if (!rawCustomQuery)
        {
            rawCustomQuery = {};
        }

        if (!rawCustomQuery.operator)
        {
            rawCustomQuery.operator = "AND";
        }

        if (!rawCustomQuery.rules)
        {
            rawCustomQuery.rules = [];
        }

        self.operator = rawCustomQuery.operator;
        self.rules = rawCustomQuery.rules.map(function(rule)
        {
            if (rule.query)
            {
                return {query: new EBCustomQuery(rule.query)};
            }
            else
            {
                return {
                    condition: rule.condition,
                    field: rule.field,
                    data: rule.data
                };
            }
        });
    }

    /**
     * Returns a JSON-Schema schema for EBCustomQuery
     *
     * @returns {object} The JSON-Schema that can be used for validating query object
     */
    static schema()
    {
        return {
            "id": "EBCustomQuery",
            "type": "object",
            "properties": {
                operator: {
                    "type": "string",
                    "enum": ["AND", "OR"]
                },
                rules: {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            condition: {
                                "type": "string",
                                "enum": ['=', '<>', '<', '<=', '>=', '>']
                            },
                            field: {"type": "string"},
                            data: {},
                            query: {"$ref": "#"}
                        }
                    }
                }
            }
        };
    }
}

EBClassFactory.registerClass('EBCustomQuery', EBCustomQuery, EBCustomQuery.schema());

module.exports = EBCustomQuery;
