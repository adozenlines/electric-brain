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
 * This class represents a neural network architectures. It specifies where the data comes from and how
 * it gets transformed for the neural network. It then specifies the design of that neural network.
 */
class EBArchitecture
{
    /**
     * This constructs a full architecture object from the given raw JSON data.
     *
     * @param {object} rawArchitecture The raw JSON data describing a architecture
     */
    constructor(rawArchitecture)
    {
        this.name = rawArchitecture.name;
        this.classType = "EBArchitecture";
    }

    /**
     * Returns a machine name for this architecture
     */
    get machineName()
    {
        const self = this;

        // strip out symbols into spaces
        const stripped = self.name.replace(/[^\w\s]/g, " ").replace(/_/g, " ");

        // title case the rest
        const titleCased = stripped.replace(/\w\S*/g, function(txt)
        {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }).replace(/\s+/g, "");

        return titleCased;
    }

    /**
     * Returns a JSON-Schema schema for this architectures
     *
     * @returns {object} The JSON-Schema that can be used for validating this architectures in its raw form
     */
    static schema()
    {
        return {
            "id": "EBArchitecture",
            "type": "object",
            "properties": {
                "_id": {},
                "name": {"type": "string"},
                "classType": {"type": "string"}
            }
        };
    }
}

EBClassFactory.registerClass('EBArchitecture', EBArchitecture, EBArchitecture.schema());

module.exports = EBArchitecture;
