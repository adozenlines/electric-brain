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
    Ajv = require('ajv'),
    assert = require('assert'),
    async = require('async'),
    deepdiff = require("deep-diff").diff,
    EBClassFactory = require("../components/EBClassFactory"),
    EBConfusionMatrix = require("./EBConfusionMatrix"),
    EBFieldMetadata = require("./EBFieldMetadata"),
    stringUtilities = require("../utilities/string"),
    underscore = require('underscore');

// Symbol definitions for the private/hidden variables within EBSchema
const _parent = Symbol("_parent");
const _depth = Symbol("_depth");

/**
 * This class represents an electric brain schema. Electric Brain Schemas are
 * our own modified version of json-schema. This is how we store the description
 * of database schemas, which can be annotated with additional information.
 *
 * It is a subset of json-schema, but with new fields added that don't overlap with the
 * existing json-schema fields. Therefore, we can simply apply the standard json-schema
 * specification to these schemas, filtering out unexpected fields, and we should get
 * a standard json-schema.gtf
 */
class EBSchema
{
    /**
     * Constructs an EBSchema object given the raw data for a schema object.
     *
     * @param {object} rawSchema This is the raw data for an EBSchema. This would be the verbatim
     *                           JSON that we would store in the database, or send over the wire.
     * @param {number} [depth] Optional. This is the depth this schema is within the overall schema.
     */
    constructor(rawSchema, depth)
    {
        const self = this;
        
        self.classType = "EBSchema";
        
        self[_parent] = null;

        // rawSchema.type MUST be present
        assert(rawSchema.type);

        if (!depth)
        {
            self[_depth] = 0;
        }
        else
        {
            self[_depth] = depth;
        }

        // Copy the data from the rawSchema into our self.
        Object.keys(rawSchema).forEach(function(key)
        {
            if (key === 'properties')
            {
                self.properties = {};
                underscore.sortBy(Object.keys(rawSchema.properties), (propertyName) => propertyName).forEach(function(propertyName)
                {
                    self.properties[propertyName] = new EBSchema(rawSchema.properties[propertyName], self[_depth] + 1);
                    self.properties[propertyName][_parent] = self;
                });
            }
            else if (key === 'items')
            {
                self.items = new EBSchema(rawSchema.items, self[_depth] + 1);
                self.items[_parent] = self;
            }
            else if (key === 'metadata')
            {
                self.metadata = new EBFieldMetadata(rawSchema.metadata);
            }
            else if (key === 'configuration')
            {
                self.configuration = rawSchema.configuration;
            }
            else if (key === 'results')
            {
                self.results = rawSchema.results;
            }
            else if (key === 'type')
            {
                if (underscore.isArray(rawSchema.type))
                {
                    self.type = rawSchema.type;
                }
                else
                {
                    self.type = [rawSchema.type];
                }

                // Make sure each of the types are valid
                const validTypes = ['string', 'number', 'binary', 'boolean', 'array', 'object', 'null'];
                self.type.forEach(function(type)
                {
                    if (validTypes.indexOf(type) === -1)
                    {
                        throw new Error(`Can not create an EBSchema with the given type: ${type}. This type is not supported`);
                    }
                });
            }
            else
            {
                self[key] = rawSchema[key];
            }
        });

        // Make sure we at least have metadata & configuration information
        if (!self.metadata)
        {
            self.metadata = new EBFieldMetadata();
        }
        if (!self.configuration)
        {
            self.configuration = {};
        }
        if (!self.results)
        {
            self.results = {confusionMatrix: new EBConfusionMatrix({})};
        }

        // Fill in variable name if its missing
        if (!self.metadata.variableName)
        {
            self.updateVariableNamesAndPaths();
        }
    }

    /**
     * Returns the parent schema object of this schema.
     *
     * @returns {EBSchema} An EBSchema object that is the parent of this one. Null if there is no parent.
     */
    get parent()
    {
        return this[_parent];
    }

    /**
     * Returns the depth of this schema within the overall schema
     *
     * @returns {Number} The number of layers that this schema is embedded within the root schema. If this schema
     *                   is the root, then depth is 0
     */
    get depth()
    {
        return this[_depth];
    }

    /**
     * Returns whether this schema is a field. A field represents a single value, like a string, boolean, or number,
     * rather then an object or array which both contain multiple values.
     *
     * @returns {Boolean} True if this schema represents a field, false otherwise.
     */
    get isField()
    {
        return underscore.intersection(this.type, ["array", "object"]).length === 0;
    }

    /**
     * Returns whether this schema is an object.
     *
     * @returns {Boolean} True if this schema represents an object, false otherwise.
     */
    get isObject()
    {
        return this.type.indexOf('object') !== -1;
    }

    /**
     * Returns whether this schema is an array.
     *
     * @returns {Boolean} True if this schema represents an array, false otherwise.
     */
    get isArray()
    {
        return this.type.indexOf('array') !== -1;
    }

    /**
     * Returns whether this schema is a string
     *
     * @returns {Boolean} True if this schema represents a string, false otherwise.
     */
    get isString()
    {
        return this.type.indexOf('string') !== -1;
    }

    /**
     * Returns whether this schema is a number.
     *
     * @returns {Boolean} True if this schema represents a number, false otherwise
     */
    get isNumber()
    {
        return this.type.indexOf('number') !== -1;
    }

    /**
     * Returns whether this schema is a boolean.
     *
     * @returns {Boolean} True if this schema represents a boolean, false otherwise
     */
    get isBoolean()
    {
        return this.type.indexOf('boolean') !== -1;
    }

    /**
     * Returns whether this schema is binary data.
     *
     * @returns {Boolean} True if this schema represents binary data, false otherwise
     */
    get isBinary()
    {
        return this.type.indexOf('binary') !== -1;
    }

    /**
     * Returns whether null is an accepted value for this schema
     *
     * @returns {Boolean} True if "null" is accept in place of other values, false otherwise
     */
    get canBeNull()
    {
        return this.type.indexOf('null') !== -1;
    }

    /**
     * Returns the variable name of this schema within its parent schema.
     *
     * @returns {string} The variable name of this schema within its parent schema, or null
     *                   if this is the root schema.
     */
    get variableName()
    {
        return this.metadata.variableName;
    }

    /**
     * Machine variable name is just the variable name but reduced to just letters, numbers, and underscores
     *
     * @returns {string} The machine version of the variable name
     */
    get machineVariableName()
    {
        return this.metadata.variableName.replace(/\W/g, "");
    }

    /**
     * Returns the full path to this variable from the root of the schema
     *
     * @returns {string} The variable name of this schema within its parent schema, or null
     *                   if this is the root schema.
     */
    get variablePath()
    {
        return this.metadata.variablePath;
    }

    /**
     * Machine variable path is just the variable path but reduced to just letters, numbers, and underscores
     *
     * @returns {string} The machine version of the variable name
     */
    get machineVariablePath()
    {
        return this.metadata.variablePath.replace(/\[\]/g, "_array_").replace(/\W/g, "");
    }

    /**
     * This returns the variable path from the given schema object (must be a parent of
     * the current schema) down to this schema object
     *
     * @param {EBSchema} otherSchema A parent schema of the current schema
     *
     * @returns {string} The variable name of this schema within its parent schema, or null
     *                   if this is the root schema.
     */
    variablePathFrom(otherSchema)
    {
        if (this.variablePath.indexOf(otherSchema.variablePath) !== 0)
        {
            throw new Error("Error in EBSchema::variablePathFrom! The otherSchema provided does not appear to be a parent of this schema.");
        }
        return this.variablePath.substring(otherSchema.variablePath.length);
    }

    /**
     * This function returns the list of fields that are immediate descendants of this schema.
     *
     * This is only applicable for object schemas, for all other schemas, this will return []
     *
     * @returns { [EBSchema] } An array filled with all of the field schemas.
     */
    get fields()
    {
        const self = this;
        if (!self.isObject)
        {
            return [];
        }
        else
        {
            if (!self.properties)
            {
                return [];
            }

            return underscore.map(underscore.filter(Object.keys(self.properties), function(fieldName)
            {
                return self.properties[fieldName].isField;
            }), function(fieldName)
            {
                return self.properties[fieldName];
            });
        }
    }


    /**
     * This function returns the list of sequences that are immediate descendants of this schema.
     *
     * This is only applicable for object schemas, for all other schemas, this will return []
     *
     * @returns { [EBSchema] } An array filled with all of the array schemas.
     */
    get sequences()
    {
        const self = this;
        if (!self.isObject)
        {
            return [];
        }
        else
        {
            if (!self.properties)
            {
                return [];
            }

            return underscore.map(underscore.filter(Object.keys(self.properties), function(fieldName)
            {
                return self.properties[fieldName].isArray;
            }), function(fieldName)
            {
                return self.properties[fieldName];
            });
        }
    }


    /**
     * This function returns the list of objects that are immediate descendants of this schema.
     *
     * This is only applicable for object schemas, for all other schemas, this will return []
     *
     * @returns { [EBSchema] } An array filled with all of the object schemas.
     */
    get objects()
    {
        const self = this;
        if (!self.isObject)
        {
            return [];
        }
        else
        {
            if (!self.properties)
            {
                return [];
            }

            return underscore.map(underscore.filter(Object.keys(self.properties), function(fieldName)
            {
                return self.properties[fieldName].isObject;
            }), function(fieldName)
            {
                return self.properties[fieldName];
            });
        }
    }


    /**
     * This function returns the list of binary fields that are immediate descendants of this schema
     *
     * This is only applicable for object schemas, for all other schemas, this will return []
     *
     * @returns { [EBSchema] } An array filled with all of the binary schemas.
     */
    get binaries()
    {
        const self = this;
        if (!self.isObject)
        {
            return [];
        }
        else
        {
            if (!self.properties)
            {
                return [];
            }

            return underscore.map(underscore.filter(Object.keys(self.properties), function(fieldName)
            {
                return self.properties[fieldName].isBinary;
            }), function(fieldName)
            {
                return self.properties[fieldName];
            });
        }
    }


    /**
     * This function returns the immediate descendants of this schema in an array form.
     *
     * @returns { [EBSchema] } An array filled with all immediate descendants of this schema.
     */
    get children()
    {
        const self = this;
        if (self.isObject)
        {
            return underscore.values(self.properties);
        }

        return [];
    }


    /**
     * This function returns a complete list schemas in the tree, including the root, its children,
     * and all of its children's children, and so forth.
     *
     * The schemas still retain their child/parent relationships. They are just put into
     * an array for convenient processing.
     *
     * @returns { [EBSchema] } An array filled with all schemas within the tree, including the root.
     */
    get allSchemas()
    {
        const self = this;
        let schemas = [self];

        if (self.isObject)
        {
            schemas = schemas.concat(underscore.flatten(underscore.map(Object.keys(self.properties), function(propertyName)
            {
                return self.properties[propertyName].allSchemas;
            })));
        }
        else if (self.isArray)
        {
            schemas = schemas.concat(self.items.allSchemas);
        }

        return schemas;
    }


    /**
     * This function returns a complete list of variable paths within the tree.
     *
     * @returns { [String] } An array filled with strings with all the variable paths for every schema in the tree.
     */
    get allVariablePaths()
    {
        const self = this;
        return underscore.map(self.allSchemas, (schema) => schema.variablePath);
    }


    /**
     * This function can be used to set whether the given field is included.
     *
     * This will also update child/parent schemas as appropriate
     *
     * @param {boolean} included True/False on whether this current schema should be included or not.
     */
    setIncluded(included)
    {
        if (!included)
        {
            this.configuration.included = false;
            // Walk down the schema and uninclude everything lower
            this.walk(function(field)
            {
                field.configuration.included = false;
            });
        }
        else
        {
            // Set our included value and make sure our parents is too
            this.configuration.included = true;
            this.climb(function(field)
            {
                field.configuration.included = true;
            });
        }
    }

    /**
     * The all handy clone function. It returns another EBSchema object that is a copy of this one
     *
     * @returns {EBSchema} A new EBSchema object.
     */
    clone()
    {
        const self = this;
        return new EBSchema(JSON.parse(JSON.stringify(self)));
    }


    /**
     * This function is used to just walk through every field/sub-schema on the schema.
     *
     * It calls the given callback function on every field/sub-schema
     *
     * @param {function(field, parent)} func The function that will be called on every sub-schema of the schema
     */
    walk(func)
    {
        const recurse = function(field)
        {
            if (field.isObject)
            {
                const variableNames = Object.keys(field.properties || {});
                variableNames.forEach(function(variableName)
                {
                    // Decide whether we are going to keep the given variable
                    func(field.properties[variableName], field);
                    recurse(field.properties[variableName]);
                });
            }
            else if (field.isArray)
            {
                if (field.items)
                {
                    func(field.items, field);
                    recurse(field.items);
                }
            }
        };

        recurse(this);
    }


    /**
     * This function is used to climb up the schema through every parent schema of the current
     * schema. Its similar to walk(), except that it goes upwards instead of downwards.
     *
     * @param {function(field, parent)} func The function that will be called on every parent schema of the current schema
     */
    climb(func)
    {
        let field = this[_parent];
        while (field)
        {
            func(field);
            field = field[_parent];
        }
    }

    /**
     * This function creates a new EBSchema which has
     * filtered out fields based on the filter function
     *
     * @param {function(field)} filter A function which will be given a particular field within the
     *                                 overall schema and must return true if it should be kept,
     *                                 false if it should be removed.
     *
     * @returns {EBSchema} A new EBSchema object.
     */
    filter(filter)
    {
        // Make a clone of the given json schema.
        const resultSchema = this.clone();

        const recurse = function(root, field)
        {
            if (field.isObject)
            {
                const variableNames = Object.keys(field.properties || {});
                variableNames.forEach(function(variableName)
                {
                    // Decide whether we are going to keep the given variable
                    const keep = filter(field.properties[variableName]);
                    if (!keep)
                    {
                        delete field.properties[variableName];
                    }
                    else
                    {
                        const newRoot = `${root}.${variableName}`;
                        recurse(newRoot, field.properties[variableName]);

                        // If, after recursion, the field in question is an
                        // empty array or empty object, we still delete it.
                        if (field.properties[variableName].isObject && Object.keys(field.properties[variableName].properties || {}).length === 0)
                        {
                            delete field.properties[variableName];
                        }
                        else if (field.properties[variableName].isArray && Object.keys(field.properties[variableName].items.properties).length === 0)
                        {
                            delete field.properties[variableName];
                        }
                    }
                });
            }
            else if (field.isArray)
            {
                if (field.items)
                {
                    const newRoot = `${root}[]`;
                    recurse(newRoot, field.items);
                }
            }
        };

        recurse("", resultSchema);

        return new EBSchema(resultSchema);
    }

    /**
     * This function creates a new EBSchema which only contains fields have have been selected for inclusion by having
     * the "included" metadata field set to true.
     *
     * @returns {EBSchema} A new EBSchema object.
     */
    filterIncluded()
    {
        return this.filter(function(field)
        {
            if (!field.configuration || !field.configuration.included)
            {
                return false;
            }
            else
            {
                return true;
            }
        });
    }


    /**
     * This function is used to walk over an object that fits this schema. It is assumed that the object fits the schema -
     * no validation is done to ensure that it does.
     *
     * It calls the given callback function on every field, along with the schema for that field and its parent
     *
     * @param {object} object The object that should be walked
     * @param {function(fieldName, value, fieldSchema, parent, parentSchema)} func The function that will be called on every sub-schema of the schema
     */
    walkObject(object, func)
    {
        const recurse = function(subObject, schema)
        {
            if (schema.isObject)
            {
                const variableNames = Object.keys(schema.properties || {});
                variableNames.forEach(function(variableName)
                {
                    func(variableName, subObject[variableName], schema.properties[variableName], subObject, schema);
                    recurse(subObject[variableName], schema.properties[variableName]);
                });
            }
            else if (schema.isArray)
            {
                if (schema.items)
                {
                    subObject.forEach(function(item, index)
                    {
                        func(index, item, schema.items, subObject, schema);
                        recurse(item, schema.items);
                    });
                }
            }
        };

        recurse(object, this);
    }


    /**
     * This function is used to walk over an object that fits this schema. Similar to walkObject, except that
     * the iterator function can be asynchronous.
     *
     * @param {object} object The object that should be walked
     * @param {function(fieldName, value, fieldSchema, parent, parentSchema, next)} func The function that will be called on every sub-schema of the schema.
     * @param {function(err)} callback The callback to be called after the schema has been completely walked
     */
    walkObjectAsync(object, func, callback)
    {
        this.walkObjectsAsync([object], function(fieldName, values, fieldSchema, parents, parentSchema, next)
        {
            return func(fieldName, values[0], fieldSchema, parents[0], parentSchema, next);
        }, callback);
    }


    /**
     * This function is used to walk over a set of objects that fit this schema. Similar to walkObjectAsync, except that
     * it is capable of iterating multiple objects in parallel, allowing you to easily compare values between two
     * different objects
     *
     * @param {[object]} objects The objects that should be walked
     * @param {function(fieldName, values, fieldSchema, parents, parentSchema, next)} func The function that will be called on every sub-schema of the schema.
     * @param {function(err)} callback The callback to be called after the schema has been completely walked
     */
    walkObjectsAsync(objects, func, callback)
    {
        const recurse = function(fieldName, subObjects, subSchema, parentObjects, parentSchema, next)
        {
            /**
             * @param {function()} next Callback after sub schemas have been analyzed
             * @returns {*} nothing
             */
            function examineSubSchemas(next)
            {
                if (subSchema.isObject)
                {
                    const variableNames = Object.keys(subSchema.properties || {});
                    async.eachSeries(variableNames, function(variableName, next)
                    {
                        const parallelObjects = [];
                        subObjects.forEach(function(subObject)
                        {
                            if (!underscore.isUndefined(subObject[variableName]))
                            {
                                parallelObjects.push(subObject[variableName]);
                            }
                        });

                        if (parallelObjects.length > 0)
                        {
                            recurse(variableName, parallelObjects, subSchema.properties[variableName], subObjects, subSchema, next);
                        }
                        else
                        {
                            async.nextTick(next);
                        }
                    }, next);
                }
                else if (subSchema.isArray)
                {
                    if (subSchema.items)
                    {
                        const longest = underscore.max(subObjects, (subObject) => subObject.length).length;
                        let itemIndex = 0;
                        async.whilst(function()
                        {
                            return itemIndex < longest;
                        },
                        function(next)
                        {
                            // Put together all of the objects which have an item at this index
                            const subObjectsWithItem = [];
                            subObjects.forEach(function(subObject)
                            {
                                if (subObject.length > itemIndex)
                                {
                                    subObjectsWithItem.push(subObject);
                                }
                            });

                            const items = underscore.map(subObjectsWithItem, (subObject) => (subObject[itemIndex]));
                            recurse(itemIndex, items, subSchema.items, subObjectsWithItem, subSchema, function(err)
                            {
                                if (err)
                                {
                                    return next(err);
                                }
                                else
                                {
                                    itemIndex += 1;
                                    async.nextTick(next);
                                }
                            });
                        }, next);
                    }
                    else
                    {
                        return next();
                    }
                }
                else
                {
                    return next();
                }
            }

            if (parentObjects !== null)
            {
                func(fieldName, subObjects, subSchema, parentObjects, parentSchema, function(err)
                {
                    if (err)
                    {
                        return next(err);
                    }

                    examineSubSchemas(next);
                });
            }
            else
            {
                examineSubSchemas(next);
            }
        };

        recurse("", objects, this, null, null, callback);
    }


    /**
     * This can be used to arbitrarily transform this schema into a new schema based on a transform function.
     *
     * @param {function(schema)} iterator This function will be called on each schema object
     *                                    in the the tree under the root object. It can do several
     *                                    things with it:
     *                                      - Return false to have this schema removed from its parent.
     *                                      - Return true to keep the schema unchanged and recurse into its children if available
     *                                      - Return a new schema to replace this schema with another schema within its parent. This new schema will not be traversed
     *                                      - If it is an object schema, you have the option of modifying its `properties` in any way you wish. The system will proceed to walk over the new properties, so make sure you don't filter those out as well if you don't want to
     *                                      - If it is an array schema, you can change its `items` schema in any way you want before this algorithm will iterate into it. Make sure that whatever the changed form is, your iterator will accept the result!
     * @returns {EBSchema} A new schema object
     */
    transform(iterator)
    {
        // Make a clone of the given json schema.
        const resultSchema = this.clone();

        const recurse = function(root, field)
        {
            if (field.isObject)
            {
                const variableNames = Object.keys(field.properties || {});
                variableNames.forEach(function(variableName)
                {
                    // Get what the iterator decides for this schema
                    const result = iterator(field.properties[variableName]);
                    if (result === false)
                    {
                        delete field.properties[variableName];
                    }
                    else if (result === true)
                    {
                        const newRoot = `${root}.${variableName}`;
                        recurse(newRoot, field.properties[variableName]);

                        // If, after recursion, the field in question is an
                        // empty array or empty object, we still delete it.
                        if (field.properties[variableName].isObject && Object.keys(field.properties[variableName].properties).length === 0)
                        {
                            delete field.properties[variableName];
                        }
                        else if (field.properties[variableName].isArray && (!field.properties[variableName].items || Object.keys(field.properties[variableName].items.properties).length === 0))
                        {
                            delete field.properties[variableName];
                        }
                    }
                    else if (result instanceof EBSchema)
                    {
                        field.properties[variableName] = result;
                    }
                    else
                    {
                        throw new Error("EBSchema::transform: Unrecognized return value from iterator function");
                    }
                });
            }
            else if (field.isArray)
            {
                if (field.items)
                {
                    const newRoot = `${root}[]`;
                    recurse(newRoot, field.items);
                }
            }
        };

        recurse("", resultSchema);

        return new EBSchema(resultSchema);
    }


    /**
     * This can be used to arbitrarily transform an object matching this schema into something new.
     *
     * @param {object} object An arbitrary object matching this schema.
     *
     * @param {function(key, value, schema, parent, parentSchema)} iterator This function will be called on each value within the object.
     *                                    The iterator should return the new intended value for that field. If there is no change, return
     *                                    the value itself. If you return undefined, it will be omitted from the final object.
     * @returns {object} A completely new object.
     */
    transformObject(object, iterator)
    {
        const recurse = function(subObject, schema)
        {
            if (schema.isObject)
            {
                const newObject = {};

                const variableNames = Object.keys(schema.properties || {});
                variableNames.forEach(function(variableName)
                {
                    // Decide whether we are going to keep the given variable
                    let newValue = iterator(variableName, subObject[variableName], schema.properties[variableName], subObject, schema);
                    if (!underscore.isUndefined(newValue))
                    {
                        newValue = recurse(newValue, schema.properties[variableName]);
                    }
                    if (!underscore.isUndefined(newValue))
                    {
                        newObject[variableName] = newValue;
                    }
                });

                if (Object.keys(newObject).length > 0)
                {
                    return newObject;
                }
                else
                {
                    return undefined;
                }
            }
            else if (schema.isArray)
            {
                if (schema.items)
                {
                    const newArray = underscore.filter(subObject.map(function(item, index)
                    {
                        let newValue = iterator(index, item, schema.items, subObject, schema);
                        newValue = recurse(newValue, schema.items);
                        return newValue;
                    }), (value) => !underscore.isUndefined(value));

                    return newArray;
                }
                else
                {
                    return subObject;
                }
            }
            else
            {
                return subObject;
            }
        };

        return recurse(object, this);
    }

    /**
     * This method will walk the internal schema, updating the internal references for the parent
     * on each field. This must be done if any new fields are added anywhere in the schema.
     */
    updateParentReferences()
    {
        this.walk(function(field, parent)
        {
            field[_parent] = parent;
        });
    }


    /**
     * This function returns a list of all of the fields that would be used as neural network inputs
     * on this schema. This can include fields that are embedded within a sub-object, but not within
     * arrays, which must be processed as sequences
     *
     * Important to note here that top-level is from the perspective of *this* schema, not considering
     * all of its parent schemas.
     *
     * @returns {[EBSchema]} An array of EBSchema objects for each field.
     */
    get topLevelFields()
    {
        const self = this;

        // Return a version of the schema with arrays removed
        const flattenedSchema = self.filter(function(schema)
        {
            if (schema.isArray)
            {
                return false;
            }

            return true;
        });

        // Now walk the flattened schema, and return all of its fields as array items
        const fields = [];
        flattenedSchema.walk(function(schema)
        {
            if (schema.isField)
            {
                fields.push(schema);
            }
        });

        return fields;
    }


    /**
     * This function returns a list of all the sequences within the top level of this schema.
     *
     * Important to note here that top-level is from the perspective of *this* schema, not considering
     * all of its parent schemas.
     *
     * @returns {[EBSchema]} An array of EBSchema objects for each top level array
     */
    get topLevelSequences()
    {
        const self = this;

        let sequences = [];

        if (self.type[0] !== "object")
        {
            return [];
        }
        else if (self.properties)
        {
            Object.keys(self.properties).forEach(function(fieldName)
            {
                const schema = self.properties[fieldName];
                if (schema.isArray)
                {
                    sequences.push(schema);
                }
                else if (schema.isObject)
                {
                    sequences = sequences.concat(schema.topLevelSequences);
                }
            });
        }

        return sequences;
    }


    /**
     * This function returns the field tensor size for this schema. This is the number of discrete
     * floats are required to represent this schema in the data. This completely ignores all sequences
     * in this schema.
     * 
     * TODO: DEPRECATED
     *
     * @returns {Number} The tensor size of this field
     */
    get tensorSize()
    {
        const self = this;
        if (self.isObject)
        {
            let tensorSize = 0;
            const variableNames = Object.keys(self.properties || {});
            variableNames.forEach(function(variableName)
            {
                if (!self.properties[variableName].isArray)
                {
                    tensorSize += self.properties[variableName].tensorSize;
                }
            });
            return tensorSize;
        }
        else if (self.enum)
        {
            return self.enum.length;
        }
        else if (self.isNumber || self.isBoolean)
        {
            return 1;
        }
        else
        {
            return 0;
        }
    }


    /**
     * This function computes a new schema that is the intersection between this and other schema,
     * meaning that it will only contain fields that are common to both schemas.
     *
     * TODO: Rename to intersectionWith
     *
     * @param {EBSchema} schema The schema to compute the intersection with.
     * @returns {EBSchema} A new EBSchema object containing only the fields that are common between both the input and output schema
     */
    intersection(schema)
    {
        // Make a clone to hold the result
        const resultSchema = this.clone();
        const recurse = function(root, thisSchema, otherSchema)
        {
            const differences = deepdiff(thisSchema.type, otherSchema.type);
            if (differences && differences.length > 0)
            {
                return false;
            }

            if (thisSchema.isObject)
            {
                const thisVariableNames = Object.keys(thisSchema.properties || {});
                const otherVariableNames = Object.keys(otherSchema.properties || {});

                // Any variable names found in this schema and not in the other, we delete
                const variablesToRemove = underscore.difference(thisVariableNames, otherVariableNames);
                const commonVariables = underscore.intersection(thisVariableNames, otherVariableNames);

                if (commonVariables.length === 0)
                {
                    return false;
                }

                // Go through the remaining variables that are common to both
                commonVariables.forEach(function(variableName)
                {
                    // Recurse into the schemas for these variables
                    const keep = recurse(`${root}.${variableName}`, thisSchema.properties[variableName], otherSchema.properties[variableName]);
                    if (!keep)
                    {
                        variablesToRemove.push(variableName);
                    }
                });

                variablesToRemove.forEach(function(variableName)
                {
                    delete thisSchema.properties[variableName];
                });

                return true;
            }
            else if (thisSchema.isArray)
            {
                if (thisSchema.items && otherSchema.items)
                {
                    return recurse(`${root}.[]`, thisSchema.items, otherSchema.items);
                }
                else
                {
                    return false;
                }
            }
            else
            {
                return true;
            }
        };

        const keep = recurse("", resultSchema, schema);
        if (keep)
        {
            return new EBSchema(resultSchema);
        }
        else
        {
            return null;
        }
    }


    /**
     * This function computes a new schema that is that contains all of the fields within
     * this schema that aren't within the other schema.
     *
     * @param {EBSchema} schema The schema to compute the difference with.
     * @returns {EBSchema} A new EBSchema object containing only the fields within the main schema that aren't in the other schema
     */
    difference(schema)
    {
        // Make a clone to hold the result
        const resultSchema = this.clone();
        const recurse = function(root, thisSchema, otherSchema)
        {
            const differences = deepdiff(thisSchema.type, otherSchema.type);
            if (differences && differences.length > 0)
            {
                return true;
            }

            if (thisSchema.isObject)
            {
                const thisFieldNames = thisSchema.fields.map((field) => field.variableName);
                const otherFieldNames = otherSchema.fields.map((field) => field.variableName);

                // Any variable names found in both schemas should be removed
                const variablesToRemove = underscore.intersection(thisFieldNames, otherFieldNames);
                const nonFields = thisSchema.objects.concat(thisSchema.sequences);

                // Go through the objects and arrays and recurse into them
                nonFields.forEach(function(nonFieldSchema)
                {
                    const variableName = nonFieldSchema.variableName;
                    if (otherSchema.properties[variableName])
                    {
                        // Recurse into the schemas for these variables
                        const keep = recurse(`${root}.${variableName}`, thisSchema.properties[variableName], otherSchema.properties[variableName]);
                        if (!keep)
                        {
                            variablesToRemove.push(variableName);
                        }
                    }
                });

                variablesToRemove.forEach(function(variableName)
                {
                    delete thisSchema.properties[variableName];
                });

                if (thisSchema.properties && Object.keys(thisSchema.properties).length > 0)
                {
                    return true;
                }
                else
                {
                    return false;
                }
            }
            else if (thisSchema.isArray)
            {
                if (thisSchema.items && otherSchema.items)
                {
                    return recurse(`${root}.[]`, thisSchema.items, otherSchema.items);
                }
                else
                {
                    return false;
                }
            }
            else
            {
                return false;
            }
        };

        const keep = recurse("", resultSchema, schema);
        if (keep)
        {
            return new EBSchema(resultSchema);
        }
        else
        {
            return null;
        }
    }


    /**
     * This function computes a new schema that is the union of both this and other schema.
     * It will contain all of the fields that existed in either schema. If both schemas have
     * the same field, but with different properties, it will raise an error.
     *
     * @param {EBSchema} schema The schema to compute the union with.
     * @returns {EBSchema} A new EBSchema object containing all of the fields from either of the schemas
     */
    union(schema)
    {
        // Make a clone to hold the result
        const resultSchema = this.clone();
        const recurse = function(root, thisSchema, otherSchema)
        {
            const differences = deepdiff(thisSchema.type, otherSchema.type);
            if (differences && differences.length > 0)
            {
                throw Error("Unable to compute union - two schemas have to be merged, but they have different types!");
            }

            if (thisSchema.isObject)
            {
                const thisVariableNames = Object.keys(thisSchema.properties || {});
                const otherVariableNames = Object.keys(otherSchema.properties || {});

                // Any variable names found in this schema and not in the other, we delete
                const variablesToAdd = underscore.difference(otherVariableNames, thisVariableNames);
                const commonVariables = underscore.intersection(thisVariableNames, otherVariableNames);

                if (!thisSchema.properties && variablesToAdd.length > 0)
                {
                    thisSchema.properties = {};
                }

                // Go through each variable to add, and add it to the primary schema
                variablesToAdd.forEach(function(variableName)
                {
                    thisSchema.properties[variableName] = otherSchema.properties[variableName];
                });

                // Go through the remaining variables that are common to both
                commonVariables.forEach(function(variableName)
                {
                    // Recurse into the schemas for these variables
                    recurse(`${root}.${variableName}`, thisSchema.properties[variableName], otherSchema.properties[variableName]);
                });
            }
            else if (thisSchema.isArray)
            {
                if (thisSchema.items && otherSchema.items)
                {
                    return recurse(`${root}.[]`, thisSchema.items, otherSchema.items);
                }
            }
        };

        recurse("", resultSchema, schema);

        return new EBSchema(resultSchema);
    }


    /**
     * This function converts this schema into a string as a compact, human readable tree for easy debugging
     *
     * @returns {string} A human reable string describing the schema
     */
    toString()
    {
        const self = this;
        const indent = '    ';
        if (self.isField)
        {
            if (self.variableName)
            {
                return `EBSchema(${self.type.join(' ')} "${self.variableName}")`;
            }
            else
            {
                return `EBSchema(${self.type.join(' ')})`;
            }
        }
        else if (self.isObject)
        {
            let string = "";
            if (self.variableName)
            {
                string = `EBSchema(object "${self.variableName}") {`;
            }
            else
            {
                string = 'EBSchema(object) {';
            }

            string += '\n';

            if (self.properties)
            {
                Object.keys(self.properties).forEach(function(variableName)
                {
                    string += `${indent}${self.properties[variableName].toString().replace(/\n/g, `\n${indent}`)}\n`;
                });
            }

            string += "}";

            return string;
        }
        else if (self.isArray)
        {
            let string = "";
            if (self.variableName)
            {
                string = `EBSchema(array "${self.variableName}") {`;
            }
            else
            {
                string = 'EBSchema(array) {';
            }

            string += '\n';

            if (self.items)
            {
                string += `${indent}${self.items.toString().replace(/\n/g, `\n${indent}`)}\n`;
            }

            string += "}";

            return string;
        }
    }


    /**
     * This method is used to recompute all of the variableNames and variablePaths
     * for all schemas down from this schema
     */
    updateVariableNamesAndPaths()
    {
        const recurse = function(field, name, path)
        {
            field.metadata.variableName = name;
            field.metadata.variablePath = path;

            if (field.isObject)
            {
                const variableNames = Object.keys(field.properties || {});
                variableNames.forEach(function(variableName)
                {
                    // Decide whether we are going to keep the given variable
                    recurse(field.properties[variableName], variableName, `${path}.${variableName}`);
                });
            }
            else if (field.isArray)
            {
                if (field.items)
                {
                    recurse(field.items, "[]", `${path}.[]`);
                }
            }
        };

        recurse(this, "", "");
    }


    /**
     * This method is used to generate a Cap'nProto schema document describing this JSON Schema.
     * see https://capnproto.org/language.html. We use Cap'nProto to flexibly serialize documents.
     *
     * @param {string} name The name for the root schema object.
     * @param {string} id The Cap'nProto id object returned by running `capnp id`
     *
     * @returns {string} A string containing the Cap'nProto schema document.
     */
    generateCapnProtoSchema(name, id)
    {
        const self = this;
        if (!self.isObject)
        {
            throw new Error("EBSchema.generateCapnProtoSchema can only be called on object schemas!");
        }

        if (self.isObject)
        {
            let result = "";
            result += `struct ${name} {\n`;
            if (self.properties)
            {
                let propertyIndex = 0;
                self.objects.forEach(function(objectSchema)
                {
                    const subSchemaName = `${stringUtilities.toTitleCase(objectSchema.variableName)}`;
                    const subSchema = objectSchema.generateCapnProtoSchema(subSchemaName);
                    result = `${subSchema}\n${result}`;
                    result += `    ${objectSchema.variableName} @${propertyIndex} :${subSchemaName};\n`;
                    propertyIndex += 1;
                });

                self.sequences.forEach(function(arraySchema)
                {
                    const subSchemaName = `${stringUtilities.toTitleCase(arraySchema.variableName)}`;
                    const subSchema = arraySchema.items.generateCapnProtoSchema(subSchemaName);
                    result = `${subSchema}\n${result}`;
                    result += `    ${arraySchema.variableName} @${propertyIndex} :List(${subSchemaName});\n`;
                    propertyIndex += 1;
                });

                self.fields.forEach(function(fieldSchema)
                {
                    if (fieldSchema.isString)
                    {
                        result += `    ${fieldSchema.variableName} @${propertyIndex} :Text;\n`;
                    }
                    else if (fieldSchema.isNumber)
                    {
                        result += `    ${fieldSchema.variableName} @${propertyIndex} :Float32;\n`;
                    }
                    else if (fieldSchema.isBoolean)
                    {
                        result += `    ${fieldSchema.variableName} @${propertyIndex} :Bool;\n`;
                    }
                    else if (fieldSchema.isBinary)
                    {
                        result += `    ${fieldSchema.variableName} @${propertyIndex} :Data;\n`;
                    }
                    propertyIndex += 1;
                });
            }

            result += `}`;

            if (id)
            {
                result = `${id};\n\n${result}`;
            }

            return result;
        }

        return "";
    }


    /**
     * This function returns a function that can be used to validate objects against this
     * schema.
     *
     * @param {boolean} [filterAdditional] Whether or not to filter out additional fields that aren't in the schema.
     *
     * @returns {function(object)} A function which can quickly validate objects against this schema.
     *                             This function will throw an error if the object is invalid.
     */
    validator(filterAdditional)
    {
        const self = this;

        // Our custom EBSchema isn't 100% compatible with JSON schema, so we have to convert
        // our schema to a valid JSON schema in order to use it with the ultra fast ajv.
        // Primary concern here is the 'binary' field, which we can easily switch to a string
        // field because we store binary values in base64 format.
        const validatorSchema = self.transform(function(schema)
        {
            if (schema.isBinary)
            {
                return new EBSchema({type: "string"});
            }
            return true;
        });

        const ajv = new Ajv({
            removeAdditional: filterAdditional ? "all" : false,
            allErrors: true,
            useDefaults: true
        });

        const func = ajv.compile(validatorSchema);

        return function(object)
        {
            const result = func(object);
            if (!result)
            {
                let message = '';

                func.errors.forEach(function(error)
                {
                    message += `value ${error.dataPath} ${error.message}\n`;
                });

                throw new Error(message);
            }
            return true;
        };
    }


    /**
     * Returns a function that can filter objects for only fields that are marked as included on this schema
     *
     * @returns {function(object)} A function which can strip objects of any fields that aren't marked as included on the schema
     */
    filterFunction()
    {
        const self = this;

        return function(object)
        {
            return self.transformObject(object, function(key, value, schema, parent, parentSchema)
            {
                if (schema.configuration.included)
                {
                    return value;
                }
                return undefined;
            });
        };
    }

    /**
     * This is a convenience method, allowing you to easily copy over all configuration from one schema over to another, presumably
     * similar schema. All fields which are common to both schemas will get their configuration transferred.
     *
     * @param {EBSchema} schema This is the schema object from which to copy configuration
     */
    copyConfigurationFrom(schema)
    {
        // First, we map the other schemas fields
        const fields = {};
        schema.walk(function(subSchema)
        {
            fields[subSchema.variablePath] = subSchema;
        });

        // Now we walk through ourselves, setting configuration as appropriate
        this.walk(function(subSchema)
        {
            if (fields[subSchema.variablePath])
            {
                subSchema.configuration = fields[subSchema.variablePath].configuration;
            }
        });
    }

    /**
     * This finds an EBSchema object within the hierarchy.
     *
     * @param {string} variablePath The path name of the variable to look for
     *
     * @returns {EBSchema} The EBSchema object
     */
    find(variablePath)
    {
        let found = null;
        this.walk((subSchema) =>
        {
            if (subSchema.variablePath === variablePath)
            {
                found = subSchema;
            }
        });
        
        return found;
    }


    /**
     * This method creates a new EBSchema object representing a fixed size vector. These are used to hold
     * intermediaries in the architecture
     *
     * @param {number} size This is the size of the vector.
     *
     * @return {EBSchema} An schema of type 'object' which contains all of the numbers of the vector
     */
    static generateVectorSchema(size)
    {
        const schema = {
            title: `vector${size}`,
            type: "object",
            properties: {}
        };

        for (let vectorIndex = 0; vectorIndex < size; vectorIndex += 1)
        {
            const propertyName = `v${vectorIndex + 1}`;
            schema.properties[propertyName] = {type: "number"};
        }

        return new EBSchema(schema);
    }


    /**
     * Returns a JSON-Schema schema for EBSchema
     *
     * This can get a bit confusing because technically this is a meta-schema, a schema for
     * describing schemas.
     *
     * @returns {object} The JSON-Schema that can be used for validating this architectures in its raw form
     */
    static schema()
    {
        return {
            "id": "EBSchema",
            "$schema": "EBSchema",
            "description": "Core schema meta-schema",
            "definitions": {
                "schemaArray": {
                    "type": "array",
                    "minItems": 1,
                    "items": {"$ref": "#"}
                },
                "positiveInteger": {
                    "type": "integer",
                    "minimum": 0
                },
                "positiveIntegerDefault0": {"allOf": [{"$ref": "#/definitions/positiveInteger"}, {"default": 0}]},
                "simpleTypes": {"enum": ["array", "boolean", "integer", "null", "number", "object", "string", "binary"]},
                "stringArray": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 1,
                    "uniqueItems": true
                }
            },
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "format": "uri"
                },
                "$schema": {
                    "type": "string",
                    "format": "uri"
                },
                "title": {"type": "string"},
                "description": {"type": "string"},
                "default": {},
                "multipleOf": {
                    "type": "number",
                    "minimum": 0,
                    "exclusiveMinimum": true
                },
                "maximum": {"type": "number"},
                "exclusiveMaximum": {
                    "type": "boolean",
                    "default": false
                },
                "minimum": {"type": "number"},
                "exclusiveMinimum": {
                    "type": "boolean",
                    "default": false
                },
                "maxLength": {"$ref": "#/definitions/positiveInteger"},
                "minLength": {"$ref": "#/definitions/positiveIntegerDefault0"},
                "pattern": {
                    "type": "string",
                    "format": "regex"
                },
                "additionalItems": {
                    "anyOf": [
                        {"type": "boolean"},
                        {"$ref": "#"}
                    ],
                    "default": {}
                },
                "items": {
                    "anyOf": [
                        {"$ref": "#"},
                        {"$ref": "#/definitions/schemaArray"}
                    ],
                    "default": {}
                },
                "maxItems": {"$ref": "#/definitions/positiveInteger"},
                "minItems": {"$ref": "#/definitions/positiveIntegerDefault0"},
                "uniqueItems": {
                    "type": "boolean",
                    "default": false
                },
                "maxProperties": {"$ref": "#/definitions/positiveInteger"},
                "minProperties": {"$ref": "#/definitions/positiveIntegerDefault0"},
                "required": {"$ref": "#/definitions/stringArray"},
                "additionalProperties": {
                    "anyOf": [
                        {"type": "boolean"},
                        {"$ref": "#"}
                    ],
                    "default": {}
                },
                "definitions": {
                    "type": "object",
                    "additionalProperties": {"$ref": "#"},
                    "default": {}
                },
                "properties": {
                    "type": "object",
                    "additionalProperties": {"$ref": "#"},
                    "default": {}
                },
                "patternProperties": {
                    "type": "object",
                    "additionalProperties": {"$ref": "#"},
                    "default": {}
                },
                "dependencies": {
                    "type": "object",
                    "additionalProperties": {
                        "anyOf": [
                            {"$ref": "#"},
                            {"$ref": "#/definitions/stringArray"}
                        ]
                    }
                },
                "enum": {
                    "type": "array",
                    "minItems": 1,
                    "uniqueItems": true
                },
                "type": {
                    "anyOf": [
                        {"$ref": "#/definitions/simpleTypes"},
                        {
                            "type": "array",
                            "items": {"$ref": "#/definitions/simpleTypes"},
                            "minItems": 1,
                            "uniqueItems": true
                        }
                    ]
                },
                "allOf": {"$ref": "#/definitions/schemaArray"},
                "anyOf": {"$ref": "#/definitions/schemaArray"},
                "oneOf": {"$ref": "#/definitions/schemaArray"},
                "not": {"$ref": "#"},
                "metadata": EBFieldMetadata.schema(),
                "configuration": {
                    "type": "object",
                    "properties": {
                        "included": {"type": "boolean"},
                        "interpretation": {
                            "type": "object",
                            "additionalProperties": true
                        },
                        "component": {
                            "type": "object",
                            "additionalProperties": true
                        }
                    }
                },
                "results": {
                    "type": "object",
                    "additionalProperties": true
                }
            },
            "dependencies": {
                "exclusiveMaximum": ["maximum"],
                "exclusiveMinimum": ["minimum"]
            },
            "default": {}
        };
    }
}

EBClassFactory.registerClass('EBSchema', EBSchema, EBSchema.schema());

module.exports = EBSchema;
