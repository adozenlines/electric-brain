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

/**
 * This class represents a global factory that can be used to create Electric Brain objects from their JSON forms,
 * without needing to know the type of the object. We can then validate that object. This facilitates having
 * complex hierarchies that are serialized to / from the database and to / from the browser conveniently
 */
class EBClassFactory
{
    /**
     * This constructs the EBClassFactory. There should only be a single instance throughout the application.
     */
    constructor()
    {
        this.classes = {};
    }


    /**
     * This method registers the given class name with its appropriate constructor.
     *
     * @param {String} className The name of the class which being registered
     * @param {function(rawJSON)} constructor The constructor for the class being registered
     * @param {object} schema The JSON-schema for the object being registered.
     */
    registerClass(className, constructor)
    {
        this.classes[className] = constructor;
    }


    /**
     * This method creates the full-version of an object from the stripped-down JSON version
     *
     * @param {object} rawJSONData The raw JSON data that needs to be turned into a full object. The JSON data must contain a 'classType' variable
     *                             with the class-name - this is standard on all ElectricBrain objects.
     */
    createObject(rawJSONData)
    {
        if (!rawJSONData.classType)
        {
            throw new Error("The raw JSON data provided to EBClassFactory.createObject does not contain any type information!");
        }
        else if (!this.classes[rawJSONData.classType])
        {
            throw new Error(`There are no registered classes for ${rawJSONData.classType} within the EBClassFactory`);
        }
        else
        {
            return new (this.classes[rawJSONData.classType])(rawJSONData);
        }
    }
}


// Create the global singleton object and expose that
const globalSingleton = new EBClassFactory();
module.exports = globalSingleton;
