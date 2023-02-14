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
    assert = require('assert'),
    models = require("../../../shared/models/models");

/**
 * In this section, we define a bunch of testing schemas that will get reused in many of the unit tests below
 */

// An object that has no properties. Useful for testing edge cases
const emptyObjectSchema = new models.EBSchema({
    type: "object",
    properties: {}
});

// A flat object with the four basic types - string, number, boolean, and binary
const flatObjectSchema = new models.EBSchema({
    type: "object",
    properties: {
        age: {type: "number"},
        dead: {type: "boolean"},
        image: {type: "binary"},
        name: {type: "string"}
    }
});

// A basic user-ish schema. Good for testing a variety of things, including nested fields
const comboUserSchema = new models.EBSchema({
    type: "object",
    properties: {
        age: {type: ["number", "null"]},
        dead: {type: "boolean"},
        name: {type: "string"},
        image: {type: "binary"},
        status: {
            type: "string",
            enum: ["active", "deleted"]
        },
        password: {
            type: "object",
            properties: {
                hashMethod: {type: ["string", "null"]},
                hashValue: {type: "string"}
            }
        }
    }
});

// A simple array with with a flat object nested in it
const flatObjectListSchema = new models.EBSchema({
    type: "object",
    properties: {
        users: {
            type: "array",
            items: flatObjectSchema.clone()
        }
    }
});

// A list of user objects, each following the comboUserSchema.
// Good for testing array functionality
const comboUserSchemaList = new models.EBSchema({
    type: "object",
    properties: {
        users: {
            type: "array",
            items: comboUserSchema.clone()
        }
    }
});

// An incomplete schema for describing a recipe
const recipeSchema = new models.EBSchema({
    type: "object",
    properties: {
        title: {type: "string"},
        ingredients: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    description: {type: "string"},
                    unitOfMeasurement: {type: "string"},
                    amount: {type: "number"}
                }
            }
        }
    }
});


describe("EBSchema tests", function()
{
    describe("EBSchema constructor", function()
    {
        it("should raise an exception if you attempt to create a schema with an unsupported type", function()
        {
            assert.doesNotThrow(function()
            {
                return new models.EBSchema({type: "string"});
            });

            assert.doesNotThrow(function()
            {
                return new models.EBSchema({type: "boolean"});
            });

            assert.doesNotThrow(function()
            {
                return new models.EBSchema({type: "number"});
            });

            assert.doesNotThrow(function()
            {
                return new models.EBSchema({type: "binary"});
            });

            assert.doesNotThrow(function()
            {
                return new models.EBSchema({type: "object"});
            });

            assert.doesNotThrow(function()
            {
                return new models.EBSchema({type: "array"});
            });

            assert.throws(function()
            {
                return new models.EBSchema({type: "float"});
            });

            assert.throws(function()
            {
                return new models.EBSchema({type: "int"});
            });

            assert.throws(function()
            {
                return new models.EBSchema({type: ""});
            });

            assert.throws(function()
            {
                return new models.EBSchema({type: null});
            });

            assert.throws(function()
            {
                return new models.EBSchema({type: ["number", "float"]});
            });

            assert.throws(function()
            {
                return new models.EBSchema({type: ["number", "int"]});
            });

            assert.throws(function()
            {
                return new models.EBSchema({type: ["number", ""]});
            });

            assert.throws(function()
            {
                return new models.EBSchema({type: ["number", null]});
            });
        });

        it("should automatically sort property names on object schemas to ensure consistency", function()
        {
            const schema = new models.EBSchema({
                type: "object",
                properties: {
                    b: {type: "number"},
                    a: {type: "number"},
                    c: {type: "number"},
                    a3: {type: "number"},
                    a1: {type: "number"},
                    d: {type: "number"}
                }
            });

            const keys = Object.keys(schema.properties);
            assert.equal(keys.length, 6);
            assert.equal(keys[0], "a");
            assert.equal(keys[1], "a1");
            assert.equal(keys[2], "a3");
            assert.equal(keys[3], "b");
            assert.equal(keys[4], "c");
            assert.equal(keys[5], "d");
        });
    });


    describe("EBSchema.variableName and EBSchema.variablePath", function()
    {
        it("Root variableName and variablePath on the root object should be empty", function()
        {
            const schema = emptyObjectSchema;

            assert.equal(schema.variableName, "");
            assert.equal(schema.variablePath, "");
        });


        it("Schemas within an object should use dot notation for their variablePath. Their variableName should only be the last segment.", function()
        {
            const schema = comboUserSchema;

            assert.equal(schema.properties.age.variablePath, ".age");
            assert.equal(schema.properties.dead.variablePath, ".dead");
            assert.equal(schema.properties.image.variablePath, ".image");
            assert.equal(schema.properties.name.variablePath, ".name");
            assert.equal(schema.properties.status.variablePath, ".status");
            assert.equal(schema.properties.password.variablePath, ".password");
            assert.equal(schema.properties.password.properties.hashMethod.variablePath, ".password.hashMethod");
            assert.equal(schema.properties.password.properties.hashValue.variablePath, ".password.hashValue");

            assert.equal(schema.properties.age.variableName, "age");
            assert.equal(schema.properties.dead.variableName, "dead");
            assert.equal(schema.properties.image.variableName, "image");
            assert.equal(schema.properties.name.variableName, "name");
            assert.equal(schema.properties.status.variableName, "status");
            assert.equal(schema.properties.password.variableName, "password");
            assert.equal(schema.properties.password.properties.hashMethod.variableName, "hashMethod");
            assert.equal(schema.properties.password.properties.hashValue.variableName, "hashValue");
        });


        it("Schemas within an array should use .[] to signify the array", function()
        {
            const schema = comboUserSchemaList;

            assert.equal(schema.properties.users.variablePath, ".users");
            assert.equal(schema.properties.users.items.variablePath, ".users.[]");
            assert.equal(schema.properties.users.items.properties.age.variablePath, ".users.[].age");
            assert.equal(schema.properties.users.items.properties.dead.variablePath, ".users.[].dead");
            assert.equal(schema.properties.users.items.properties.image.variablePath, ".users.[].image");
            assert.equal(schema.properties.users.items.properties.name.variablePath, ".users.[].name");
            assert.equal(schema.properties.users.items.properties.status.variablePath, ".users.[].status");
            assert.equal(schema.properties.users.items.properties.password.variablePath, ".users.[].password");
            assert.equal(schema.properties.users.items.properties.password.properties.hashMethod.variablePath, ".users.[].password.hashMethod");
            assert.equal(schema.properties.users.items.properties.password.properties.hashValue.variablePath, ".users.[].password.hashValue");


            assert.equal(schema.properties.users.variableName, "users");
            assert.equal(schema.properties.users.items.variableName, "[]");
            assert.equal(schema.properties.users.items.properties.age.variableName, "age");
            assert.equal(schema.properties.users.items.properties.dead.variableName, "dead");
            assert.equal(schema.properties.users.items.properties.image.variableName, "image");
            assert.equal(schema.properties.users.items.properties.name.variableName, "name");
            assert.equal(schema.properties.users.items.properties.status.variableName, "status");
            assert.equal(schema.properties.users.items.properties.password.variableName, "password");
            assert.equal(schema.properties.users.items.properties.password.properties.hashMethod.variableName, "hashMethod");
            assert.equal(schema.properties.users.items.properties.password.properties.hashValue.variableName, "hashValue");
        });


        it("[BUG] variablePath and variableName should continue to work even if sub-schemas are cloned.", function()
        {
            const schema = comboUserSchemaList;

            assert.equal(schema.properties.users.clone().variablePath, ".users");
            assert.equal(schema.properties.users.items.clone().variablePath, ".users.[]");
            assert.equal(schema.properties.users.items.properties.age.clone().variablePath, ".users.[].age");
            assert.equal(schema.properties.users.items.properties.dead.clone().variablePath, ".users.[].dead");
            assert.equal(schema.properties.users.items.properties.image.clone().variablePath, ".users.[].image");
            assert.equal(schema.properties.users.items.properties.name.clone().variablePath, ".users.[].name");
            assert.equal(schema.properties.users.items.properties.status.clone().variablePath, ".users.[].status");
            assert.equal(schema.properties.users.items.properties.password.clone().variablePath, ".users.[].password");
            assert.equal(schema.properties.users.items.properties.password.properties.hashMethod.clone().variablePath, ".users.[].password.hashMethod");
            assert.equal(schema.properties.users.items.properties.password.properties.hashValue.clone().variablePath, ".users.[].password.hashValue");


            assert.equal(schema.properties.users.clone().variableName, "users");
            assert.equal(schema.properties.users.items.clone().variableName, "[]");
            assert.equal(schema.properties.users.items.properties.age.clone().variableName, "age");
            assert.equal(schema.properties.users.items.properties.dead.clone().variableName, "dead");
            assert.equal(schema.properties.users.items.properties.image.clone().variableName, "image");
            assert.equal(schema.properties.users.items.properties.name.clone().variableName, "name");
            assert.equal(schema.properties.users.items.properties.status.clone().variableName, "status");
            assert.equal(schema.properties.users.items.properties.password.clone().variableName, "password");
            assert.equal(schema.properties.users.items.properties.password.properties.hashMethod.clone().variableName, "hashMethod");
            assert.equal(schema.properties.users.items.properties.password.properties.hashValue.clone().variableName, "hashValue");
        });
    });


    describe("EBSchema.variablePathFrom", function()
    {
        it("variablePathFrom should return a relative path one schema and one of its parents.", function()
        {
            const schema = comboUserSchemaList;

            assert.equal(schema.properties.users.variablePathFrom(schema), ".users");
            assert.equal(schema.properties.users.items.variablePathFrom(schema), ".users.[]");
            assert.equal(schema.properties.users.items.properties.age.variablePathFrom(schema), ".users.[].age");
            assert.equal(schema.properties.users.items.properties.dead.variablePathFrom(schema), ".users.[].dead");
            assert.equal(schema.properties.users.items.properties.image.variablePathFrom(schema), ".users.[].image");
            assert.equal(schema.properties.users.items.properties.name.variablePathFrom(schema), ".users.[].name");
            assert.equal(schema.properties.users.items.properties.status.variablePathFrom(schema), ".users.[].status");
            assert.equal(schema.properties.users.items.properties.password.variablePathFrom(schema), ".users.[].password");
            assert.equal(schema.properties.users.items.properties.password.properties.hashMethod.variablePathFrom(schema), ".users.[].password.hashMethod");
            assert.equal(schema.properties.users.items.properties.password.properties.hashValue.variablePathFrom(schema), ".users.[].password.hashValue");


            assert.equal(schema.properties.users.items.variablePathFrom(schema.properties.users), ".[]");
            assert.equal(schema.properties.users.items.properties.age.variablePathFrom(schema.properties.users), ".[].age");
            assert.equal(schema.properties.users.items.properties.dead.variablePathFrom(schema.properties.users), ".[].dead");
            assert.equal(schema.properties.users.items.properties.image.variablePathFrom(schema.properties.users), ".[].image");
            assert.equal(schema.properties.users.items.properties.name.variablePathFrom(schema.properties.users), ".[].name");
            assert.equal(schema.properties.users.items.properties.status.variablePathFrom(schema.properties.users), ".[].status");
            assert.equal(schema.properties.users.items.properties.password.variablePathFrom(schema.properties.users), ".[].password");
            assert.equal(schema.properties.users.items.properties.password.properties.hashMethod.variablePathFrom(schema.properties.users), ".[].password.hashMethod");
            assert.equal(schema.properties.users.items.properties.password.properties.hashValue.variablePathFrom(schema.properties.users), ".[].password.hashValue");


            assert.equal(schema.properties.users.items.properties.age.variablePathFrom(schema.properties.users.items), ".age");
            assert.equal(schema.properties.users.items.properties.dead.variablePathFrom(schema.properties.users.items), ".dead");
            assert.equal(schema.properties.users.items.properties.image.variablePathFrom(schema.properties.users.items), ".image");
            assert.equal(schema.properties.users.items.properties.name.variablePathFrom(schema.properties.users.items), ".name");
            assert.equal(schema.properties.users.items.properties.status.variablePathFrom(schema.properties.users.items), ".status");
            assert.equal(schema.properties.users.items.properties.password.variablePathFrom(schema.properties.users.items), ".password");
            assert.equal(schema.properties.users.items.properties.password.properties.hashMethod.variablePathFrom(schema.properties.users.items), ".password.hashMethod");
            assert.equal(schema.properties.users.items.properties.password.properties.hashValue.variablePathFrom(schema.properties.users.items), ".password.hashValue");


            assert.equal(schema.properties.users.items.properties.password.properties.hashMethod.variablePathFrom(schema.properties.users.items.properties.password), ".hashMethod");
            assert.equal(schema.properties.users.items.properties.password.properties.hashValue.variablePathFrom(schema.properties.users.items.properties.password), ".hashValue");
        });


        it("variablePathFrom should throw an error if the given schema is not a parent of the caller schema.", function()
        {
            const schema = comboUserSchemaList;
            const alternativeSchema = recipeSchema;

            assert.throws(function()
            {
                schema.variablePathFrom(schema.properties.users);
            });

            assert.throws(function()
            {
                schema.variablePathFrom(schema.properties.users.items);
            });

            assert.throws(function()
            {
                schema.properties.users.items.properties.name.variablePathFrom(schema.properties.users.items.properties.age);
            });

            assert.throws(function()
            {
                schema.properties.users.items.properties.password.properties.hashMethod.variablePathFrom(schema.properties.users.items.properties.name);
            });

            assert.throws(function()
            {
                schema.properties.users.variablePathFrom(alternativeSchema.properties.title);
            });

            assert.throws(function()
            {
                schema.properties.users.variablePathFrom(alternativeSchema.properties.ingredients.items.properties.amount);
            });

            assert.throws(function()
            {
                schema.properties.users.items.properties.name.variablePathFrom(alternativeSchema.properties.ingredients.items.properties.amount);
            });
        });
    });

    describe("EBSchema.parent", function()
    {
        it("should always point to the parent schema", function()
        {
            const schema = comboUserSchemaList;

            assert.equal(schema.parent, null);
            assert.equal(schema.properties.users.parent, schema);
            assert.equal(schema.properties.users.items.parent, schema.properties.users);
            assert.equal(schema.properties.users.items.properties.age.parent, schema.properties.users.items);
            assert.equal(schema.properties.users.items.properties.dead.parent, schema.properties.users.items);
            assert.equal(schema.properties.users.items.properties.image.parent, schema.properties.users.items);
            assert.equal(schema.properties.users.items.properties.name.parent, schema.properties.users.items);
            assert.equal(schema.properties.users.items.properties.status.parent, schema.properties.users.items);
            assert.equal(schema.properties.users.items.properties.password.parent, schema.properties.users.items);
            assert.equal(schema.properties.users.items.properties.password.properties.hashMethod.parent, schema.properties.users.items.properties.password);
            assert.equal(schema.properties.users.items.properties.password.properties.hashValue.parent, schema.properties.users.items.properties.password);
        });
    });

    describe("EBSchema.depth", function()
    {
        it("Depth of the root of a schema should be 0", function()
        {
            const schema = emptyObjectSchema;

            assert.equal(schema.depth, 0);
        });


        it("Depth of fields under the root should increase by 1 each step down ones goes", function()
        {
            const schema = comboUserSchema;

            assert.equal(schema.properties.age.depth, 1);
            assert.equal(schema.properties.dead.depth, 1);
            assert.equal(schema.properties.image.depth, 1);
            assert.equal(schema.properties.name.depth, 1);
            assert.equal(schema.properties.status.depth, 1);
            assert.equal(schema.properties.password.depth, 1);
            assert.equal(schema.properties.password.properties.hashMethod.depth, 2);
            assert.equal(schema.properties.password.properties.hashValue.depth, 2);
        });


        it("depth should increase through arrays as well", function()
        {
            const schema = comboUserSchemaList;

            assert.equal(schema.properties.users.depth, 1);
            assert.equal(schema.properties.users.items.depth, 2);
            assert.equal(schema.properties.users.items.properties.age.depth, 3);
            assert.equal(schema.properties.users.items.properties.dead.depth, 3);
            assert.equal(schema.properties.users.items.properties.image.depth, 3);
            assert.equal(schema.properties.users.items.properties.name.depth, 3);
            assert.equal(schema.properties.users.items.properties.status.depth, 3);
            assert.equal(schema.properties.users.items.properties.password.depth, 3);
            assert.equal(schema.properties.users.items.properties.password.properties.hashMethod.depth, 4);
            assert.equal(schema.properties.users.items.properties.password.properties.hashValue.depth, 4);
        });
    });

    describe("EBSchema.isField", function()
    {
        it("should be true for scalar values and false for objects and arrays", function()
        {
            const schema = comboUserSchemaList;

            assert.equal(schema.isField, false);
            assert.equal(schema.properties.users.isField, false);
            assert.equal(schema.properties.users.items.isField, false);
            assert.equal(schema.properties.users.items.properties.age.isField, true);
            assert.equal(schema.properties.users.items.properties.dead.isField, true);
            assert.equal(schema.properties.users.items.properties.image.isField, true);
            assert.equal(schema.properties.users.items.properties.name.isField, true);
            assert.equal(schema.properties.users.items.properties.status.isField, true);
            assert.equal(schema.properties.users.items.properties.password.isField, false);
            assert.equal(schema.properties.users.items.properties.password.properties.hashMethod.isField, true);
            assert.equal(schema.properties.users.items.properties.password.properties.hashValue.isField, true);
        });
    });

    describe("EBSchema.isObject", function()
    {
        it("Should be true for all object schemas, false for everything else", function()
        {
            const schema = comboUserSchemaList;

            assert.equal(schema.isObject, true);
            assert.equal(schema.properties.users.isObject, false);
            assert.equal(schema.properties.users.items.isObject, true);
            assert.equal(schema.properties.users.items.properties.age.isObject, false);
            assert.equal(schema.properties.users.items.properties.dead.isObject, false);
            assert.equal(schema.properties.users.items.properties.image.isObject, false);
            assert.equal(schema.properties.users.items.properties.name.isObject, false);
            assert.equal(schema.properties.users.items.properties.status.isObject, false);
            assert.equal(schema.properties.users.items.properties.password.isObject, true);
            assert.equal(schema.properties.users.items.properties.password.properties.hashMethod.isObject, false);
            assert.equal(schema.properties.users.items.properties.password.properties.hashValue.isObject, false);
        });
    });

    describe("EBSchema.isArray", function()
    {
        it("Should be true for array schemas, false for everything else", function()
        {
            const schema = comboUserSchemaList;

            assert.equal(schema.isArray, false);
            assert.equal(schema.properties.users.isArray, true);
            assert.equal(schema.properties.users.items.isArray, false);
            assert.equal(schema.properties.users.items.properties.age.isArray, false);
            assert.equal(schema.properties.users.items.properties.dead.isArray, false);
            assert.equal(schema.properties.users.items.properties.image.isArray, false);
            assert.equal(schema.properties.users.items.properties.name.isArray, false);
            assert.equal(schema.properties.users.items.properties.status.isArray, false);
            assert.equal(schema.properties.users.items.properties.password.isArray, false);
            assert.equal(schema.properties.users.items.properties.password.properties.hashMethod.isArray, false);
            assert.equal(schema.properties.users.items.properties.password.properties.hashValue.isArray, false);
        });
    });

    describe("EBSchema.isString", function()
    {
        it("Should be true for string schemas, false for everything else", function()
        {
            const schema = comboUserSchemaList;

            assert.equal(schema.isString, false);
            assert.equal(schema.properties.users.isString, false);
            assert.equal(schema.properties.users.items.isString, false);
            assert.equal(schema.properties.users.items.properties.age.isString, false);
            assert.equal(schema.properties.users.items.properties.dead.isString, false);
            assert.equal(schema.properties.users.items.properties.image.isString, false);
            assert.equal(schema.properties.users.items.properties.name.isString, true);
            assert.equal(schema.properties.users.items.properties.status.isString, true);
            assert.equal(schema.properties.users.items.properties.password.isString, false);
            assert.equal(schema.properties.users.items.properties.password.properties.hashMethod.isString, true);
            assert.equal(schema.properties.users.items.properties.password.properties.hashValue.isString, true);
        });
    });

    describe("EBSchema.isNumber", function()
    {
        it("Should be true for number schemas, false for everything else", function()
        {
            const schema = comboUserSchemaList;

            assert.equal(schema.isNumber, false);
            assert.equal(schema.properties.users.isNumber, false);
            assert.equal(schema.properties.users.items.isNumber, false);
            assert.equal(schema.properties.users.items.properties.age.isNumber, true);
            assert.equal(schema.properties.users.items.properties.dead.isNumber, false);
            assert.equal(schema.properties.users.items.properties.image.isNumber, false);
            assert.equal(schema.properties.users.items.properties.name.isNumber, false);
            assert.equal(schema.properties.users.items.properties.status.isNumber, false);
            assert.equal(schema.properties.users.items.properties.password.isNumber, false);
            assert.equal(schema.properties.users.items.properties.password.properties.hashMethod.isNumber, false);
            assert.equal(schema.properties.users.items.properties.password.properties.hashValue.isNumber, false);
        });
    });

    describe("EBSchema.isBoolean", function()
    {
        it("Should be true for boolean schemas, false for everything else", function()
        {
            const schema = comboUserSchemaList;

            assert.equal(schema.isBoolean, false);
            assert.equal(schema.properties.users.isBoolean, false);
            assert.equal(schema.properties.users.items.isBoolean, false);
            assert.equal(schema.properties.users.items.properties.age.isBoolean, false);
            assert.equal(schema.properties.users.items.properties.dead.isBoolean, true);
            assert.equal(schema.properties.users.items.properties.image.isBoolean, false);
            assert.equal(schema.properties.users.items.properties.name.isBoolean, false);
            assert.equal(schema.properties.users.items.properties.status.isBoolean, false);
            assert.equal(schema.properties.users.items.properties.password.isBoolean, false);
            assert.equal(schema.properties.users.items.properties.password.properties.hashMethod.isBoolean, false);
            assert.equal(schema.properties.users.items.properties.password.properties.hashValue.isBoolean, false);
        });
    });

    describe("EBSchema.isBinary", function()
    {
        it("Should be true for binary schemas, false for everything else", function()
        {
            const schema = comboUserSchemaList;

            assert.equal(schema.isBinary, false);
            assert.equal(schema.properties.users.isBinary, false);
            assert.equal(schema.properties.users.items.isBinary, false);
            assert.equal(schema.properties.users.items.properties.age.isBinary, false);
            assert.equal(schema.properties.users.items.properties.dead.isBinary, false);
            assert.equal(schema.properties.users.items.properties.image.isBinary, true);
            assert.equal(schema.properties.users.items.properties.name.isBinary, false);
            assert.equal(schema.properties.users.items.properties.status.isBinary, false);
            assert.equal(schema.properties.users.items.properties.password.isBinary, false);
            assert.equal(schema.properties.users.items.properties.password.properties.hashMethod.isBinary, false);
            assert.equal(schema.properties.users.items.properties.password.properties.hashValue.isBinary, false);
        });
    });

    describe("EBSchema.canBeNull", function()
    {
        it("Returns true whether a null value is acceptable for this field", function()
        {
            let schema = comboUserSchemaList;

            assert.equal(schema.canBeNull, false);
            assert.equal(schema.properties.users.canBeNull, false);
            assert.equal(schema.properties.users.items.canBeNull, false);
            assert.equal(schema.properties.users.items.properties.age.canBeNull, true);
            assert.equal(schema.properties.users.items.properties.dead.canBeNull, false);
            assert.equal(schema.properties.users.items.properties.image.canBeNull, false);
            assert.equal(schema.properties.users.items.properties.name.canBeNull, false);
            assert.equal(schema.properties.users.items.properties.status.canBeNull, false);
            assert.equal(schema.properties.users.items.properties.password.canBeNull, false);
            assert.equal(schema.properties.users.items.properties.password.properties.hashMethod.canBeNull, true);
            assert.equal(schema.properties.users.items.properties.password.properties.hashValue.canBeNull, false);

            // Test one more case separately - the array case
            schema = new models.EBSchema({
                type: ["object"],
                properties: {
                    moreUsers: {
                        type: ["array", "null"],
                        items: {
                            type: ["object"],
                            properties: {}
                        }
                    }
                }
            });

            assert.equal(schema.properties.moreUsers.canBeNull, true);
        });
    });

    describe("EBSchema.fields", function()
    {
        it("Should be the list of fields that are immediately descended from the schema.", function()
        {
            const schema = comboUserSchemaList;

            assert.deepEqual(schema.fields, []);
            assert.deepEqual(schema.properties.users.fields, []);
            assert.deepEqual(schema.properties.users.items.fields, [
                schema.properties.users.items.properties.age,
                schema.properties.users.items.properties.dead,
                schema.properties.users.items.properties.image,
                schema.properties.users.items.properties.name,
                schema.properties.users.items.properties.status
            ]);
            assert.deepEqual(schema.properties.users.items.properties.age.fields, []);
            assert.deepEqual(schema.properties.users.items.properties.dead.fields, []);
            assert.deepEqual(schema.properties.users.items.properties.image.fields, []);
            assert.deepEqual(schema.properties.users.items.properties.name.fields, []);
            assert.deepEqual(schema.properties.users.items.properties.status.fields, []);
            assert.deepEqual(schema.properties.users.items.properties.password.fields, [
                schema.properties.users.items.properties.password.properties.hashMethod,
                schema.properties.users.items.properties.password.properties.hashValue
            ]);
            assert.deepEqual(schema.properties.users.items.properties.password.properties.hashMethod.fields, []);
            assert.deepEqual(schema.properties.users.items.properties.password.properties.hashValue.fields, []);
        });
    });

    describe("EBSchema.sequences", function()
    {
        it("Should be the list of sequences that are immediately descended from the schema.", function()
        {
            const schema = comboUserSchemaList;

            assert.deepEqual(schema.sequences, [schema.properties.users]);
            assert.deepEqual(schema.properties.users.sequences, []);
            assert.deepEqual(schema.properties.users.items.sequences, []);
            assert.deepEqual(schema.properties.users.items.properties.age.sequences, []);
            assert.deepEqual(schema.properties.users.items.properties.dead.sequences, []);
            assert.deepEqual(schema.properties.users.items.properties.image.sequences, []);
            assert.deepEqual(schema.properties.users.items.properties.name.sequences, []);
            assert.deepEqual(schema.properties.users.items.properties.status.sequences, []);
            assert.deepEqual(schema.properties.users.items.properties.password.sequences, []);
            assert.deepEqual(schema.properties.users.items.properties.password.properties.hashMethod.sequences, []);
            assert.deepEqual(schema.properties.users.items.properties.password.properties.hashValue.sequences, []);
        });
    });


    describe("EBSchema.objects", function()
    {
        it("Should be the list of objects that are immediately descended from the schema.", function()
        {
            const schema = comboUserSchemaList;

            assert.deepEqual(schema.objects, []);
            assert.deepEqual(schema.properties.users.objects, []);
            assert.deepEqual(schema.properties.users.items.objects, [
                schema.properties.users.items.properties.password
            ]);
            assert.deepEqual(schema.properties.users.items.properties.age.objects, []);
            assert.deepEqual(schema.properties.users.items.properties.image.objects, []);
            assert.deepEqual(schema.properties.users.items.properties.dead.objects, []);
            assert.deepEqual(schema.properties.users.items.properties.name.objects, []);
            assert.deepEqual(schema.properties.users.items.properties.status.objects, []);
            assert.deepEqual(schema.properties.users.items.properties.password.objects, []);
            assert.deepEqual(schema.properties.users.items.properties.password.properties.hashMethod.objects, []);
            assert.deepEqual(schema.properties.users.items.properties.password.properties.hashValue.objects, []);
        });
    });


    describe("EBSchema.binaries", function()
    {
        it("Should be the list of binary fields that are immediately descended from the schema.", function()
        {
            const schema = comboUserSchemaList;

            assert.deepEqual(schema.binaries, []);
            assert.deepEqual(schema.properties.users.binaries, []);
            assert.deepEqual(schema.properties.users.items.binaries, [
                schema.properties.users.items.properties.image
            ]);
            assert.deepEqual(schema.properties.users.items.properties.age.binaries, []);
            assert.deepEqual(schema.properties.users.items.properties.image.binaries, []);
            assert.deepEqual(schema.properties.users.items.properties.dead.binaries, []);
            assert.deepEqual(schema.properties.users.items.properties.name.binaries, []);
            assert.deepEqual(schema.properties.users.items.properties.status.binaries, []);
            assert.deepEqual(schema.properties.users.items.properties.password.binaries, []);
            assert.deepEqual(schema.properties.users.items.properties.password.properties.hashMethod.binaries, []);
            assert.deepEqual(schema.properties.users.items.properties.password.properties.hashValue.binaries, []);
        });
    });

    describe("EBSchema.allSchemas", function()
    {
        it("Should be a list of all schema objects within the tree at and below the called schema", function()
        {
            const schema = comboUserSchemaList;

            assert.deepEqual(schema.allSchemas, [
                schema,
                schema.properties.users,
                schema.properties.users.items,
                schema.properties.users.items.properties.age,
                schema.properties.users.items.properties.dead,
                schema.properties.users.items.properties.image,
                schema.properties.users.items.properties.name,
                schema.properties.users.items.properties.password,
                schema.properties.users.items.properties.password.properties.hashMethod,
                schema.properties.users.items.properties.password.properties.hashValue,
                schema.properties.users.items.properties.status
            ]);

            assert.deepEqual(schema.properties.users.allSchemas, [
                schema.properties.users,
                schema.properties.users.items,
                schema.properties.users.items.properties.age,
                schema.properties.users.items.properties.dead,
                schema.properties.users.items.properties.image,
                schema.properties.users.items.properties.name,
                schema.properties.users.items.properties.password,
                schema.properties.users.items.properties.password.properties.hashMethod,
                schema.properties.users.items.properties.password.properties.hashValue,
                schema.properties.users.items.properties.status
            ]);

            assert.deepEqual(schema.properties.users.items.allSchemas, [
                schema.properties.users.items,
                schema.properties.users.items.properties.age,
                schema.properties.users.items.properties.dead,
                schema.properties.users.items.properties.image,
                schema.properties.users.items.properties.name,
                schema.properties.users.items.properties.password,
                schema.properties.users.items.properties.password.properties.hashMethod,
                schema.properties.users.items.properties.password.properties.hashValue,
                schema.properties.users.items.properties.status
            ]);

            assert.deepEqual(schema.properties.users.items.properties.age.allSchemas, [
                schema.properties.users.items.properties.age
            ]);

            assert.deepEqual(schema.properties.users.items.properties.dead.allSchemas, [
                schema.properties.users.items.properties.dead
            ]);

            assert.deepEqual(schema.properties.users.items.properties.image.allSchemas, [
                schema.properties.users.items.properties.image
            ]);

            assert.deepEqual(schema.properties.users.items.properties.name.allSchemas, [
                schema.properties.users.items.properties.name
            ]);

            assert.deepEqual(schema.properties.users.items.properties.status.allSchemas, [
                schema.properties.users.items.properties.status
            ]);

            assert.deepEqual(schema.properties.users.items.properties.password.allSchemas, [
                schema.properties.users.items.properties.password,
                schema.properties.users.items.properties.password.properties.hashMethod,
                schema.properties.users.items.properties.password.properties.hashValue
            ]);

            assert.deepEqual(schema.properties.users.items.properties.password.properties.hashMethod.allSchemas, [
                schema.properties.users.items.properties.password.properties.hashMethod
            ]);

            assert.deepEqual(schema.properties.users.items.properties.password.properties.hashValue.allSchemas, [
                schema.properties.users.items.properties.password.properties.hashValue
            ]);
        });
    });

    describe("EBSchema.allVariablePaths", function()
    {
        it("Should be a list of all known variable paths for various schemas at and below the called schema", function()
        {
            const schema = comboUserSchemaList;

            assert.deepEqual(schema.allVariablePaths, [
                "",
                ".users",
                ".users.[]",
                ".users.[].age",
                ".users.[].dead",
                ".users.[].image",
                ".users.[].name",
                ".users.[].password",
                ".users.[].password.hashMethod",
                ".users.[].password.hashValue",
                ".users.[].status"
            ]);

            assert.deepEqual(schema.properties.users.allVariablePaths, [
                ".users",
                ".users.[]",
                ".users.[].age",
                ".users.[].dead",
                ".users.[].image",
                ".users.[].name",
                ".users.[].password",
                ".users.[].password.hashMethod",
                ".users.[].password.hashValue",
                ".users.[].status"
            ]);

            assert.deepEqual(schema.properties.users.items.allVariablePaths, [
                ".users.[]",
                ".users.[].age",
                ".users.[].dead",
                ".users.[].image",
                ".users.[].name",
                ".users.[].password",
                ".users.[].password.hashMethod",
                ".users.[].password.hashValue",
                ".users.[].status"
            ]);

            assert.deepEqual(schema.properties.users.items.properties.name.allVariablePaths, [
                ".users.[].name"
            ]);

            assert.deepEqual(schema.properties.users.items.properties.age.allVariablePaths, [
                ".users.[].age"
            ]);

            assert.deepEqual(schema.properties.users.items.properties.password.allVariablePaths, [
                ".users.[].password",
                ".users.[].password.hashMethod",
                ".users.[].password.hashValue"
            ]);

            assert.deepEqual(schema.properties.users.items.properties.password.properties.hashMethod.allVariablePaths, [
                ".users.[].password.hashMethod"
            ]);

            assert.deepEqual(schema.properties.users.items.properties.password.properties.hashValue.allVariablePaths, [
                ".users.[].password.hashValue"
            ]);
        });
    });

    describe("EBSchema.walk() ", function()
    {
        it("The walk function should not be called for the root object", function()
        {
            const schema = emptyObjectSchema;

            let iteratorCallsCount = 0;
            schema.walk(function()
            {
                iteratorCallsCount += 1;
            });

            assert.equal(iteratorCallsCount, 0);
        });


        it("The walk function should be called once for each property on the root object", function()
        {
            const schema = flatObjectSchema;

            let iteratorCallsCount = 0;
            const calls = [];
            schema.walk(function(field)
            {
                iteratorCallsCount += 1;
                calls.push(field.variableName);
            });

            assert.equal(iteratorCallsCount, 4);
            assert.equal(calls[0], "age");
            assert.equal(calls[1], "dead");
            assert.equal(calls[2], "image");
            assert.equal(calls[3], "name");
        });


        it("The walk function should traverse into arrays", function()
        {
            const schema = flatObjectListSchema;

            let iteratorCallsCount = 0;
            const calls = [];
            schema.walk(function(field)
            {
                iteratorCallsCount += 1;
                calls.push(field.variableName);
            });

            assert.equal(iteratorCallsCount, 6);
            assert.equal(calls[0], "users");
            assert.equal(calls[1], "[]");
            assert.equal(calls[2], "age");
            assert.equal(calls[3], "dead");
            assert.equal(calls[4], "image");
            assert.equal(calls[5], "name");
        });
    });


    describe("EBSchema.climb() ", function()
    {
        /**
         * This function is used for testing. It counts the number of times the iterator function
         * gets called when climb() is called on a given EBSchema object
         *
         * @param {EBSchema} schema The EBSchema object to count the iterator calls on
         * @returns {number} The number of times the iterator function was called
         */
        function countClimbIteratorCalls(schema)
        {
            let iteratorCallsCount = 0;
            schema.climb(function(field)
            {
                iteratorCallsCount += 1;
            });
            return iteratorCallsCount;
        }


        it("The climb function should not be called for the root object", function()
        {
            const schema = emptyObjectSchema;

            assert.equal(countClimbIteratorCalls(schema), 0);
        });


        it("The climb function should be called once for each parent of a field", function()
        {
            const schema = comboUserSchemaList;

            assert.equal(countClimbIteratorCalls(schema.properties.users), 1);
            assert.equal(countClimbIteratorCalls(schema.properties.users.items), 2);
            assert.equal(countClimbIteratorCalls(schema.properties.users.items.properties.age), 3);
            assert.equal(countClimbIteratorCalls(schema.properties.users.items.properties.dead), 3);
            assert.equal(countClimbIteratorCalls(schema.properties.users.items.properties.image), 3);
            assert.equal(countClimbIteratorCalls(schema.properties.users.items.properties.name), 3);
            assert.equal(countClimbIteratorCalls(schema.properties.users.items.properties.status), 3);
            assert.equal(countClimbIteratorCalls(schema.properties.users.items.properties.password), 3);
            assert.equal(countClimbIteratorCalls(schema.properties.users.items.properties.password.properties.hashMethod), 4);
            assert.equal(countClimbIteratorCalls(schema.properties.users.items.properties.password.properties.hashValue), 4);
        });


        it("The climb function should call the iterator starting from the schema, and going upwards to each parent one by one", function()
        {
            const schema = comboUserSchemaList;

            const calls = [];
            schema.properties.users.items.properties.password.properties.hashValue.climb(function(field)
            {
                calls.push(field.variableName);
            });

            assert.deepEqual(calls, [
                'password',
                '[]',
                'users',
                ''
            ]);
        });
    });


    describe("EBSchema.filter() ", function()
    {
        it("The iterator function should be called for every field within the schema tree", function()
        {
            const schema = comboUserSchemaList;

            let count = 0;

            // Count up the number of calls
            schema.filter(function(field)
            {
                count += 1;
                return true;
            });

            assert.equal(count, 9);
        });

        it("The filter function should allow you to arbitrarily filter portions to remove from a schema", function()
        {
            const schema = flatObjectListSchema;

            // Filter out all strings
            const filteredSchema = schema.filter(function(field)
            {
                if (field.isString)
                {
                    return false;
                }
                else
                {
                    return true;
                }
            });

            assert.deepEqual(filteredSchema.allVariablePaths, [
                "",
                ".users",
                ".users.[]",
                ".users.[].age",
                ".users.[].dead",
                ".users.[].image"
            ]);
        });


        it("The filter function should automatically delete objects that have all their properties removed", function()
        {
            const schema = comboUserSchemaList;

            // Filter out all strings
            const filteredSchema = schema.filter(function(field)
            {
                if (field.isString)
                {
                    return false;
                }
                else
                {
                    return true;
                }
            });

            // Make sure that .users.[].password does not show up in the list.
            // It should have been automatically deleted
            assert.equal(filteredSchema.allVariablePaths.indexOf(".users.[].password"), -1);
        });


        it("The filter function should automatically delete arrays when their objects have all their properties removed", function()
        {
            const schema = new models.EBSchema({
                type: "object",
                properties: {
                    id: {type: "number"},
                    users: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                name: {type: "string"},
                                email: {type: "string"}
                            }
                        }
                    }
                }
            });

            // Filter out all strings
            const filteredSchema = schema.filter(function(field)
            {
                if (field.isString)
                {
                    return false;
                }
                else
                {
                    return true;
                }
            });


            // Make sure that neither .users.[] and .users show up in the results
            assert.equal(filteredSchema.allVariablePaths.indexOf(".users.[]"), -1);
            assert.equal(filteredSchema.allVariablePaths.indexOf(".users"), -1);
            assert.deepEqual(filteredSchema.allVariablePaths, [
                "",
                ".id"
            ]);
        });
    });


    describe("EBSchema.filterIncluded() ", function()
    {
        it("Should provide a convenient way of marking fields for inclusion and later filtering out the rest", function()
        {
            const schema = flatObjectListSchema;

            schema.properties.users.items.properties.dead.setIncluded(true);

            const filteredSchema = schema.filterIncluded();


            assert.deepEqual(filteredSchema.allVariablePaths, [
                "",
                ".users",
                ".users.[]",
                ".users.[].dead"
            ]);
        });
    });


    describe("EBSchema.walkObject() ", function()
    {
        it("Allows you to walk over the data of an actual object which follows the schema", function()
        {
            const schema = comboUserSchemaList;

            const object = {
                users: [
                    {
                        age: 25,
                        dead: false,
                        image: new Buffer(""),
                        name: "brad",
                        status: "deleted",
                        password: {
                            hashMethod: "sha256",
                            hashValue: "abc123"
                        }
                    },
                    {
                        age: 35,
                        dead: true,
                        image: new Buffer(""),
                        name: "tim",
                        status: "active",
                        password: {
                            hashMethod: "sha256",
                            hashValue: "efg456"
                        }
                    }
                ]
            };

            let iteratorCall = 0;
            schema.walkObject(object, function(fieldName, value, fieldSchema, parentValue, parentSchema)
            {
                if (iteratorCall === 0)
                {
                    assert.equal(fieldName, "users");
                    assert.equal(value, object.users);
                    assert.equal(fieldSchema, schema.properties.users);
                    assert.equal(parentValue, object);
                    assert.equal(parentSchema, schema);
                }
                else if (iteratorCall === 1)
                {
                    assert.equal(fieldName, "0");
                    assert.equal(value, object.users[0]);
                    assert.equal(fieldSchema, schema.properties.users.items);
                    assert.equal(parentValue, object.users);
                    assert.equal(parentSchema, schema.properties.users);
                }
                else if (iteratorCall === 2)
                {
                    assert.equal(fieldName, "age");
                    assert.equal(value, object.users[0].age);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.age);
                    assert.equal(parentValue, object.users[0]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 3)
                {
                    assert.equal(fieldName, "dead");
                    assert.equal(value, object.users[0].dead);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.dead);
                    assert.equal(parentValue, object.users[0]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 4)
                {
                    assert.equal(fieldName, "image");
                    assert.equal(value, object.users[0].image);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.image);
                    assert.equal(parentValue, object.users[0]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 5)
                {
                    assert.equal(fieldName, "name");
                    assert.equal(value, object.users[0].name);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.name);
                    assert.equal(parentValue, object.users[0]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 6)
                {
                    assert.equal(fieldName, "password");
                    assert.equal(value, object.users[0].password);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.password);
                    assert.equal(parentValue, object.users[0]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 7)
                {
                    assert.equal(fieldName, "hashMethod");
                    assert.equal(value, object.users[0].password.hashMethod);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.password.properties.hashMethod);
                    assert.equal(parentValue, object.users[0].password);
                    assert.equal(parentSchema, schema.properties.users.items.properties.password);
                }
                else if (iteratorCall === 8)
                {
                    assert.equal(fieldName, "hashValue");
                    assert.equal(value, object.users[0].password.hashValue);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.password.properties.hashValue);
                    assert.equal(parentValue, object.users[0].password);
                    assert.equal(parentSchema, schema.properties.users.items.properties.password);
                }
                else if (iteratorCall === 9)
                {
                    assert.equal(fieldName, "status");
                    assert.equal(value, object.users[0].status);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.status);
                    assert.equal(parentValue, object.users[0]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 10)
                {
                    assert.equal(fieldName, "1");
                    assert.equal(value, object.users[1]);
                    assert.equal(fieldSchema, schema.properties.users.items);
                    assert.equal(parentValue, object.users);
                    assert.equal(parentSchema, schema.properties.users);
                }
                else if (iteratorCall === 11)
                {
                    assert.equal(fieldName, "age");
                    assert.equal(value, object.users[1].age);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.age);
                    assert.equal(parentValue, object.users[1]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 12)
                {
                    assert.equal(fieldName, "dead");
                    assert.equal(value, object.users[1].dead);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.dead);
                    assert.equal(parentValue, object.users[1]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 13)
                {
                    assert.equal(fieldName, "image");
                    assert.equal(value, object.users[1].image);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.image);
                    assert.equal(parentValue, object.users[1]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 14)
                {
                    assert.equal(fieldName, "name");
                    assert.equal(value, object.users[1].name);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.name);
                    assert.equal(parentValue, object.users[1]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 15)
                {
                    assert.equal(fieldName, "password");
                    assert.equal(value, object.users[1].password);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.password);
                    assert.equal(parentValue, object.users[1]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 16)
                {
                    assert.equal(fieldName, "hashMethod");
                    assert.equal(value, object.users[1].password.hashMethod);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.password.properties.hashMethod);
                    assert.equal(parentValue, object.users[1].password);
                    assert.equal(parentSchema, schema.properties.users.items.properties.password);
                }
                else if (iteratorCall === 17)
                {
                    assert.equal(fieldName, "hashValue");
                    assert.equal(value, object.users[1].password.hashValue);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.password.properties.hashValue);
                    assert.equal(parentValue, object.users[1].password);
                    assert.equal(parentSchema, schema.properties.users.items.properties.password);
                }
                else if (iteratorCall === 18)
                {
                    assert.equal(fieldName, "status");
                    assert.equal(value, object.users[1].status);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.status);
                    assert.equal(parentValue, object.users[1]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }

                iteratorCall += 1;
            });

            assert.equal(iteratorCall, 19);
        });
    });


    describe("EBSchema.walkObjectAsync() ", function()
    {
        it("Should function similarly to walkObject, except making asynchronous calls", function(callback)
        {
            const schema = comboUserSchemaList;

            const object = {
                users: [
                    {
                        age: 25,
                        dead: false,
                        image: new Buffer(""),
                        name: "brad",
                        status: "deleted",
                        password: {
                            hashMethod: "sha256",
                            hashValue: "abc123"
                        }
                    },
                    {
                        age: 35,
                        dead: true,
                        image: new Buffer(""),
                        name: "tim",
                        status: "active",
                        password: {
                            hashMethod: "sha256",
                            hashValue: "efg456"
                        }
                    }
                ]
            };

            let iteratorCall = 0;
            schema.walkObjectAsync(object, function(fieldName, value, fieldSchema, parentValue, parentSchema, next)
            {
                if (iteratorCall === 0)
                {
                    assert.equal(fieldName, "users");
                    assert.equal(value, object.users);
                    assert.equal(fieldSchema, schema.properties.users);
                    assert.equal(parentValue, object);
                    assert.equal(parentSchema, schema);
                }
                else if (iteratorCall === 1)
                {
                    assert.equal(fieldName, "0");
                    assert.equal(value, object.users[0]);
                    assert.equal(fieldSchema, schema.properties.users.items);
                    assert.equal(parentValue, object.users);
                    assert.equal(parentSchema, schema.properties.users);
                }
                else if (iteratorCall === 2)
                {
                    assert.equal(fieldName, "age");
                    assert.equal(value, object.users[0].age);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.age);
                    assert.equal(parentValue, object.users[0]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 3)
                {
                    assert.equal(fieldName, "dead");
                    assert.equal(value, object.users[0].dead);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.dead);
                    assert.equal(parentValue, object.users[0]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 4)
                {
                    assert.equal(fieldName, "image");
                    assert.equal(value, object.users[0].image);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.image);
                    assert.equal(parentValue, object.users[0]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 5)
                {
                    assert.equal(fieldName, "name");
                    assert.equal(value, object.users[0].name);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.name);
                    assert.equal(parentValue, object.users[0]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 6)
                {
                    assert.equal(fieldName, "password");
                    assert.equal(value, object.users[0].password);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.password);
                    assert.equal(parentValue, object.users[0]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 7)
                {
                    assert.equal(fieldName, "hashMethod");
                    assert.equal(value, object.users[0].password.hashMethod);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.password.properties.hashMethod);
                    assert.equal(parentValue, object.users[0].password);
                    assert.equal(parentSchema, schema.properties.users.items.properties.password);
                }
                else if (iteratorCall === 8)
                {
                    assert.equal(fieldName, "hashValue");
                    assert.equal(value, object.users[0].password.hashValue);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.password.properties.hashValue);
                    assert.equal(parentValue, object.users[0].password);
                    assert.equal(parentSchema, schema.properties.users.items.properties.password);
                }
                else if (iteratorCall === 9)
                {
                    assert.equal(fieldName, "status");
                    assert.equal(value, object.users[0].status);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.status);
                    assert.equal(parentValue, object.users[0]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 10)
                {
                    assert.equal(fieldName, "1");
                    assert.equal(value, object.users[1]);
                    assert.equal(fieldSchema, schema.properties.users.items);
                    assert.equal(parentValue, object.users);
                    assert.equal(parentSchema, schema.properties.users);
                }
                else if (iteratorCall === 11)
                {
                    assert.equal(fieldName, "age");
                    assert.equal(value, object.users[1].age);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.age);
                    assert.equal(parentValue, object.users[1]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 12)
                {
                    assert.equal(fieldName, "dead");
                    assert.equal(value, object.users[1].dead);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.dead);
                    assert.equal(parentValue, object.users[1]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 13)
                {
                    assert.equal(fieldName, "image");
                    assert.equal(value, object.users[1].image);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.image);
                    assert.equal(parentValue, object.users[1]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 14)
                {
                    assert.equal(fieldName, "name");
                    assert.equal(value, object.users[1].name);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.name);
                    assert.equal(parentValue, object.users[1]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 15)
                {
                    assert.equal(fieldName, "password");
                    assert.equal(value, object.users[1].password);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.password);
                    assert.equal(parentValue, object.users[1]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 16)
                {
                    assert.equal(fieldName, "hashMethod");
                    assert.equal(value, object.users[1].password.hashMethod);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.password.properties.hashMethod);
                    assert.equal(parentValue, object.users[1].password);
                    assert.equal(parentSchema, schema.properties.users.items.properties.password);
                }
                else if (iteratorCall === 17)
                {
                    assert.equal(fieldName, "hashValue");
                    assert.equal(value, object.users[1].password.hashValue);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.password.properties.hashValue);
                    assert.equal(parentValue, object.users[1].password);
                    assert.equal(parentSchema, schema.properties.users.items.properties.password);
                }
                else if (iteratorCall === 18)
                {
                    assert.equal(fieldName, "status");
                    assert.equal(value, object.users[1].status);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.status);
                    assert.equal(parentValue, object.users[1]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }

                iteratorCall += 1;

                return next();
            }, function(err)
            {
                if (err)
                {
                    return callback(err);
                }

                assert.equal(iteratorCall, 19);
                return callback();
            });
        });
    });


    describe("EBSchema.walkObjectsAsync() ", function()
    {
        it("Should function similarly to walkObjectAsync, except operating on mutliple objects in parallel", function(callback)
        {
            const schema = comboUserSchemaList;

            const firstObject = {
                users: [
                    {
                        age: 25,
                        dead: false,
                        image: new Buffer(""),
                        name: "brad",
                        status: "deleted",
                        password: {
                            hashMethod: "sha256",
                            hashValue: "abc123"
                        }
                    },
                    {
                        age: 35,
                        dead: true,
                        image: new Buffer(""),
                        name: "tim",
                        status: "active",
                        password: {
                            hashMethod: "sha256",
                            hashValue: "efg456"
                        }
                    }
                ]
            };

            const secondObject = {
                users: [
                    {
                        age: 45,
                        dead: false,
                        image: new Buffer(""),
                        name: "dave",
                        status: "deleted",
                        password: {
                            hashMethod: "sha256",
                            hashValue: "hij789"
                        }
                    }
                ]
            };

            let iteratorCall = 0;
            schema.walkObjectsAsync([firstObject, secondObject], function(fieldName, values, fieldSchema, parentValues, parentSchema, next)
            {
                if (iteratorCall === 0)
                {
                    assert.equal(fieldName, "users");
                    assert.deepEqual(values, [firstObject.users, secondObject.users]);
                    assert.equal(fieldSchema, schema.properties.users);
                    assert.deepEqual(parentValues, [firstObject, secondObject]);
                    assert.equal(parentSchema, schema);
                }
                else if (iteratorCall === 1)
                {
                    assert.equal(fieldName, "0");
                    assert.deepEqual(values, [firstObject.users[0], secondObject.users[0]]);
                    assert.equal(fieldSchema, schema.properties.users.items);
                    assert.deepEqual(parentValues, [firstObject.users, secondObject.users]);
                    assert.equal(parentSchema, schema.properties.users);
                }
                else if (iteratorCall === 2)
                {
                    assert.equal(fieldName, "age");
                    assert.deepEqual(values, [firstObject.users[0].age, secondObject.users[0].age]);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.age);
                    assert.deepEqual(parentValues, [firstObject.users[0], secondObject.users[0]]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 3)
                {
                    assert.equal(fieldName, "dead");
                    assert.deepEqual(values, [firstObject.users[0].dead, secondObject.users[0].dead]);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.dead);
                    assert.deepEqual(parentValues, [firstObject.users[0], secondObject.users[0]]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 4)
                {
                    assert.equal(fieldName, "image");
                    assert.deepEqual(values, [firstObject.users[0].image, secondObject.users[0].image]);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.image);
                    assert.deepEqual(parentValues, [firstObject.users[0], secondObject.users[0]]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 5)
                {
                    assert.equal(fieldName, "name");
                    assert.deepEqual(values, [firstObject.users[0].name, secondObject.users[0].name]);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.name);
                    assert.deepEqual(parentValues, [firstObject.users[0], secondObject.users[0]]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 6)
                {
                    assert.equal(fieldName, "password");
                    assert.deepEqual(values, [firstObject.users[0].password, secondObject.users[0].password]);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.password);
                    assert.deepEqual(parentValues, [firstObject.users[0], secondObject.users[0]]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 7)
                {
                    assert.equal(fieldName, "hashMethod");
                    assert.deepEqual(values, [firstObject.users[0].password.hashMethod, secondObject.users[0].password.hashMethod]);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.password.properties.hashMethod);
                    assert.deepEqual(parentValues, [firstObject.users[0].password, secondObject.users[0].password]);
                    assert.equal(parentSchema, schema.properties.users.items.properties.password);
                }
                else if (iteratorCall === 8)
                {
                    assert.equal(fieldName, "hashValue");
                    assert.deepEqual(values, [firstObject.users[0].password.hashValue, secondObject.users[0].password.hashValue]);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.password.properties.hashValue);
                    assert.deepEqual(parentValues, [firstObject.users[0].password, secondObject.users[0].password]);
                    assert.equal(parentSchema, schema.properties.users.items.properties.password);
                }
                else if (iteratorCall === 9)
                {
                    assert.equal(fieldName, "status");
                    assert.deepEqual(values, [firstObject.users[0].status, secondObject.users[0].status]);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.status);
                    assert.deepEqual(parentValues, [firstObject.users[0], secondObject.users[0]]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 10)
                {
                    assert.equal(fieldName, "1");
                    assert.deepEqual(values, [firstObject.users[1]]);
                    assert.equal(fieldSchema, schema.properties.users.items);
                    assert.deepEqual(parentValues, [firstObject.users]);
                    assert.equal(parentSchema, schema.properties.users);
                }
                else if (iteratorCall === 11)
                {
                    assert.equal(fieldName, "age");
                    assert.deepEqual(values, [firstObject.users[1].age]);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.age);
                    assert.deepEqual(parentValues, [firstObject.users[1]]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 12)
                {
                    assert.equal(fieldName, "dead");
                    assert.deepEqual(values, [firstObject.users[1].dead]);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.dead);
                    assert.deepEqual(parentValues, [firstObject.users[1]]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 13)
                {
                    assert.equal(fieldName, "image");
                    assert.deepEqual(values, [firstObject.users[1].image]);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.image);
                    assert.deepEqual(parentValues, [firstObject.users[1]]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 14)
                {
                    assert.equal(fieldName, "name");
                    assert.deepEqual(values, [firstObject.users[1].name]);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.name);
                    assert.deepEqual(parentValues, [firstObject.users[1]]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 15)
                {
                    assert.equal(fieldName, "password");
                    assert.deepEqual(values, [firstObject.users[1].password]);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.password);
                    assert.deepEqual(parentValues, [firstObject.users[1]]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }
                else if (iteratorCall === 16)
                {
                    assert.equal(fieldName, "hashMethod");
                    assert.deepEqual(values, [firstObject.users[1].password.hashMethod]);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.password.properties.hashMethod);
                    assert.deepEqual(parentValues, [firstObject.users[1].password]);
                    assert.equal(parentSchema, schema.properties.users.items.properties.password);
                }
                else if (iteratorCall === 17)
                {
                    assert.equal(fieldName, "hashValue");
                    assert.deepEqual(values, [firstObject.users[1].password.hashValue]);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.password.properties.hashValue);
                    assert.deepEqual(parentValues, [firstObject.users[1].password]);
                    assert.equal(parentSchema, schema.properties.users.items.properties.password);
                }
                else if (iteratorCall === 18)
                {
                    assert.equal(fieldName, "status");
                    assert.deepEqual(values, [firstObject.users[1].status]);
                    assert.equal(fieldSchema, schema.properties.users.items.properties.status);
                    assert.deepEqual(parentValues, [firstObject.users[1]]);
                    assert.equal(parentSchema, schema.properties.users.items);
                }

                iteratorCall += 1;

                return next();
            }, function(err)
            {
                if (err)
                {
                    return callback(err);
                }

                assert.equal(iteratorCall, 19);
                return callback();
            });
        });
    });


    describe("EBSchema.topLevelFields", function()
    {
        it("Should return all fields that are descendants of the called schema but aren't within sequences", function()
        {
            const schema = new models.EBSchema({
                type: "object",
                properties: {
                    name: {type: "string"},
                    first: {type: "number"},
                    sequence: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {another: {type: "number"}}
                        }
                    },
                    other: {type: "number"},
                    grouping: {
                        type: "object",
                        properties: {
                            secondName: {type: "string"},
                            birthday: {type: "number"}
                        }
                    }
                }
            });

            assert.deepEqual(schema.topLevelFields, [
                schema.properties.first,
                schema.properties.grouping.properties.birthday,
                schema.properties.grouping.properties.secondName,
                schema.properties.name,
                schema.properties.other
            ]);
        });
    });


    describe("EBSchema.topLevelSequences", function()
    {
        it("Should return all sequences that are descendants of the called schema that aren't within other sequences", function()
        {
            const schema = new models.EBSchema({
                type: "object",
                properties: {
                    firstObject: {
                        type: "object",
                        properties: {
                            firstSequence: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {firstNumber: {type: "number"}}
                                }
                            }
                        }
                    },
                    anotherSequence: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                anotherNumber: {type: "number"},
                                thirdSequence: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {thirdNumber: {type: "number"}}
                                    }
                                }
                            }
                        }
                    }
                }
            });

            assert.deepEqual(schema.topLevelSequences, [
                schema.properties.anotherSequence,
                schema.properties.firstObject.properties.firstSequence
            ]);
        });
    });


    describe("EBSchema.tensorSize", function()
    {
        it("Should return 1 for number schemas", function()
        {
            const schema = new models.EBSchema({type: "number"});
            assert.equal(schema.tensorSize, 1);
        });

        it("Should return 1 for boolean schemas", function()
        {
            const schema = new models.EBSchema({type: "boolean"});
            assert.equal(schema.tensorSize, 1);
        });

        it("Should be the number of distinct values for enumerations", function()
        {
            const schema = new models.EBSchema({
                type: "number",
                enum: [1, 2, 3, 7, 8, 9]
            });

            assert.equal(schema.tensorSize, 6);
        });

        it("Should returns the number of floats required to represent an object, excluding sequences", function()
        {
            const schema = new models.EBSchema({
                type: "object",
                properties: {
                    first: {type: "number"},
                    second: {type: "number"},
                    container: {
                        type: "object",
                        properties: {
                            third: {type: "number"},
                            fourth: {type: "number"}
                        }
                    },
                    sequence: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {fifth: {type: "number"}}
                        }
                    }
                }
            });

            assert.equal(schema.tensorSize, 4);
        });
    });


    describe("EBSchema.generateVectorSchema()", function()
    {
        it("Should return an object schema containing 1 property", function()
        {
            const schema = models.EBSchema.generateVectorSchema(1);
            assert.equal(schema.type, "object");
            assert.equal(Object.keys(schema.properties).length, 1);
            assert.equal(Object.keys(schema.properties)[0], "v1");
            assert.equal(schema.properties.v1.type, "number");
        });

        it("Should return an object schema containing 9 properties", function()
        {
            const schema = models.EBSchema.generateVectorSchema(9);
            assert.equal(schema.type, "object");
            assert.equal(Object.keys(schema.properties).length, 9);
            assert.equal(Object.keys(schema.properties)[0], "v1");
            assert.equal(Object.keys(schema.properties)[1], "v2");
            assert.equal(Object.keys(schema.properties)[5], "v6");
            assert.equal(Object.keys(schema.properties)[8], "v9");
            assert.equal(schema.properties.v9.type, "number");
        });

        it("Should return an object schema containing 0 properties", function()
        {
            const schema = models.EBSchema.generateVectorSchema(0);
            assert.equal(schema.type, "object");
            assert.equal(Object.keys(schema.properties).length, 0);
        });
    });


    describe("EBSchema.transform()", function()
    {
        it("Should be able to transform fields from one type to another", function()
        {
            const schema = comboUserSchemaList;

            assert.equal(schema.properties.users.items.properties.age.isString, false);
            assert.equal(schema.properties.users.items.properties.age.isNumber, true);

            assert.equal(schema.properties.users.items.properties.dead.isString, false);
            assert.equal(schema.properties.users.items.properties.dead.isNumber, false);

            assert.equal(schema.properties.users.items.properties.image.isString, false);
            assert.equal(schema.properties.users.items.properties.image.isNumber, false);

            assert.equal(schema.properties.users.items.properties.name.isString, true);
            assert.equal(schema.properties.users.items.properties.name.isNumber, false);

            assert.equal(schema.properties.users.items.properties.status.isString, true);
            assert.equal(schema.properties.users.items.properties.status.isNumber, false);

            assert.equal(schema.properties.users.items.properties.password.properties.hashMethod.isString, true);
            assert.equal(schema.properties.users.items.properties.password.properties.hashMethod.isNumber, false);

            assert.equal(schema.properties.users.items.properties.password.properties.hashValue.isString, true);
            assert.equal(schema.properties.users.items.properties.password.properties.hashValue.isNumber, false);

            const newSchema = schema.transform(function(field)
            {
                if (field.isString)
                {
                    return new models.EBSchema({type: "number"});
                }
                else
                {
                    return true;
                }
            });

            assert.deepEqual(newSchema.allVariablePaths, [
                "",
                ".users",
                ".users.[]",
                ".users.[].age",
                ".users.[].dead",
                ".users.[].image",
                ".users.[].name",
                ".users.[].password",
                ".users.[].password.hashMethod",
                ".users.[].password.hashValue",
                ".users.[].status"
            ]);

            assert.equal(newSchema.properties.users.items.properties.age.isString, false);
            assert.equal(newSchema.properties.users.items.properties.age.isNumber, true);

            assert.equal(newSchema.properties.users.items.properties.dead.isString, false);
            assert.equal(newSchema.properties.users.items.properties.dead.isNumber, false);

            assert.equal(newSchema.properties.users.items.properties.image.isString, false);
            assert.equal(newSchema.properties.users.items.properties.image.isNumber, false);

            assert.equal(newSchema.properties.users.items.properties.name.isString, false);
            assert.equal(newSchema.properties.users.items.properties.name.isNumber, true);

            assert.equal(newSchema.properties.users.items.properties.status.isString, false);
            assert.equal(newSchema.properties.users.items.properties.status.isNumber, true);

            assert.equal(newSchema.properties.users.items.properties.password.properties.hashMethod.isString, false);
            assert.equal(newSchema.properties.users.items.properties.password.properties.hashMethod.isNumber, true);

            assert.equal(newSchema.properties.users.items.properties.password.properties.hashValue.isString, false);
            assert.equal(newSchema.properties.users.items.properties.password.properties.hashValue.isNumber, true);
        });


        it("Should be able to transform object schemas into entirely different object schemas", function()
        {
            const schema = comboUserSchemaList;

            let count = 0;

            const newSchema = schema.transform(function(field)
            {
                count += 1;

                if (field.variableName === 'password')
                {
                    return new models.EBSchema({
                        type: "object",
                        properties: {sweetNumberField: {type: "number"}}
                    });
                }
                else
                {
                    return true;
                }
            });

            assert.equal(count, 7);

            assert.deepEqual(newSchema.allVariablePaths, [
                "",
                ".users",
                ".users.[]",
                ".users.[].age",
                ".users.[].dead",
                ".users.[].image",
                ".users.[].name",
                ".users.[].password",
                ".users.[].password.sweetNumberField",
                ".users.[].status"
            ]);
        });


        it("Should be able to cleave off entire branches from the schema, and they wont be iterated into", function()
        {
            const schema = new models.EBSchema({
                type: "object",
                properties: {
                    grouping: {
                        type: "object",
                        properties: {
                            count: {type: "number"},
                            users: {
                                type: "array",
                                items: comboUserSchema.clone()
                            }
                        }
                    }
                }
            });

            let count = 0;

            const newSchema = schema.transform(function(field)
            {
                count += 1;

                if (field.variableName === 'users')
                {
                    field.items = null;
                    return true;
                }
                else
                {
                    return true;
                }
            });

            assert.equal(count, 3);

            assert.deepEqual(newSchema.allVariablePaths, [
                "",
                ".grouping",
                ".grouping.count"
            ]);
        });


        it("The transform function should allow you to arbitrarily filter portions to remove from a schema", function()
        {
            const schema = flatObjectListSchema;

            // Transform the schema by filtering out all strings
            const transformedSchema = schema.transform(function(field)
            {
                if (field.isString)
                {
                    return false;
                }
                else
                {
                    return true;
                }
            });

            assert.deepEqual(transformedSchema.allVariablePaths, [
                "",
                ".users",
                ".users.[]",
                ".users.[].age",
                ".users.[].dead",
                ".users.[].image"
            ]);
        });


        it("The transform function should automatically delete objects that have all their properties removed", function()
        {
            const schema = comboUserSchemaList;

            // Transform the schema by filtering out all strings
            const transformedSchema = schema.transform(function(field)
            {
                if (field.isString)
                {
                    return false;
                }
                else
                {
                    return true;
                }
            });

            // Make sure that .users.[].password does not show up in the list.
            // It should have been automatically deleted
            assert.equal(transformedSchema.allVariablePaths.indexOf(".users.[].password"), -1);
        });


        it("The transform function should automatically delete arrays when their objects have all their properties removed", function()
        {
            const schema = new models.EBSchema({
                type: "object",
                properties: {
                    id: {type: "number"},
                    users: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                name: {type: "string"},
                                email: {type: "string"}
                            }
                        }
                    }
                }
            });

            // Filter out all strings
            const transformedSchema = schema.transform(function(field)
            {
                if (field.isString)
                {
                    return false;
                }
                else
                {
                    return true;
                }
            });


            // Make sure that neither .users.[] and .users show up in the results
            assert.equal(transformedSchema.allVariablePaths.indexOf(".users.[]"), -1);
            assert.equal(transformedSchema.allVariablePaths.indexOf(".users"), -1);
            assert.deepEqual(transformedSchema.allVariablePaths, [
                "",
                ".id"
            ]);
        });
    });


    describe("EBSchema.intersection()", function()
    {
        it("should return null for intersections between two schema objects of different types", function()
        {
            const primarySchema = new models.EBSchema({type: "string"});
            const secondarySchema = new models.EBSchema({type: "number"});

            assert.equal(primarySchema.intersection(secondarySchema), null);
        });


        it("should return a schema containing only fields in common between the two schemas", function()
        {
            const primarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    first: {type: "string"},
                    common: {type: "string"}
                }
            });

            const secondarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    second: {type: "string"},
                    common: {type: "string"}
                }
            });

            const intersectionSchema = primarySchema.intersection(secondarySchema);

            assert.deepEqual(intersectionSchema.allVariablePaths, [
                "",
                ".common"
            ]);
        });


        it("should recurse into sub object schemas and compute their intersections as well", function()
        {
            const primarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    firstObject: {
                        type: "object",
                        properties: {
                            firstField: {type: "string"},
                            commonField: {type: "string"}
                        }
                    },
                    anotherObject: {
                        type: "object",
                        properties: {secondField: {type: "string"}}
                    }
                }
            });

            const secondarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    firstObject: {
                        type: "object",
                        properties: {
                            commonField: {type: "string"},
                            secondField: {type: "string"}
                        }
                    }
                }
            });

            const intersectionSchema = primarySchema.intersection(secondarySchema);

            assert.deepEqual(intersectionSchema.allVariablePaths, [
                "",
                ".firstObject",
                ".firstObject.commonField"
            ]);
        });


        it("should eliminate objects schemas that are left with no properties", function()
        {
            const primarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    firstObject: {
                        type: "object",
                        properties: {
                            firstField: {type: "string"},
                            thirdField: {type: "string"}
                        }
                    },
                    anotherObject: {
                        type: "object",
                        properties: {secondField: {type: "string"}}
                    }
                }
            });

            const secondarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    firstObject: {
                        type: "object",
                        properties: {
                            secondField: {type: "string"},
                            fourthField: {type: "string"}
                        }
                    }
                }
            });

            const intersectionSchema = primarySchema.intersection(secondarySchema);

            // Make sure firstObject does not show up in variablePaths
            assert.equal(intersectionSchema.allVariablePaths.indexOf(".firstObject"), -1);
        });


        it("should eliminate array schemas who's items are left with no properties", function()
        {
            const primarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    firstArray: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                firstField: {type: "string"},
                                thirdField: {type: "string"}
                            }
                        }
                    }
                }
            });

            const secondarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    firstArray: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                secondField: {type: "string"},
                                fourthField: {type: "string"}
                            }
                        }
                    }
                }
            });

            const intersectionSchema = primarySchema.intersection(secondarySchema);

            // Make sure firstObject does not show up in variablePaths
            assert.equal(intersectionSchema.allVariablePaths.indexOf(".firstArray"), -1);
        });


        it("should recurse into array schemas", function()
        {
            const primarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    firstArray: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                firstField: {type: "string"},
                                commonField: {type: "string"}
                            }
                        }
                    }
                }
            });

            const secondarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    firstArray: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                secondField: {type: "string"},
                                commonField: {type: "string"}
                            }
                        }
                    }
                }
            });

            const intersectionSchema = primarySchema.intersection(secondarySchema);

            assert.deepEqual(intersectionSchema.allVariablePaths, [
                "",
                ".firstArray",
                ".firstArray.[]",
                ".firstArray.[].commonField"
            ]);
        });
    });

    
    describe("EBSchema.difference()", function()
    {
        it("should the first schema when both schemas are different types", function()
        {
            const primarySchema = new models.EBSchema({type: "string"});
            const secondarySchema = new models.EBSchema({type: "number"});

            assert.deepEqual(primarySchema.difference(secondarySchema), new models.EBSchema({type: "string"}));
        });


        it("should return a schema containing only fields in the first schema that aren't in the second", function()
        {
            const primarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    first: {type: "string"},
                    common: {type: "string"}
                }
            });

            const secondarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    second: {type: "string"},
                    common: {type: "string"}
                }
            });

            const differenceSchema = primarySchema.difference(secondarySchema);

            assert.deepEqual(differenceSchema.allVariablePaths, [
                "",
                ".first"
            ]);
        });


        it("should recurse into sub object schemas and compute the differences of their fields as well", function()
        {
            const primarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    firstObject: {
                        type: "object",
                        properties: {
                            firstField: {type: "string"},
                            commonField: {type: "string"}
                        }
                    },
                    anotherObject: {
                        type: "object",
                        properties: {secondField: {type: "string"}}
                    }
                }
            });

            const secondarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    firstObject: {
                        type: "object",
                        properties: {
                            commonField: {type: "string"},
                            secondField: {type: "string"}
                        }
                    }
                }
            });

            const differenceSchema = primarySchema.difference(secondarySchema);

            assert.deepEqual(differenceSchema.allVariablePaths, [
                "",
                ".anotherObject",
                ".anotherObject.secondField",
                ".firstObject",
                ".firstObject.firstField"
            ]);
        });


        it("should eliminate objects schemas that are left with no properties", function()
        {
            const primarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    firstObject: {
                        type: "object",
                        properties: {
                            firstField: {type: "string"},
                            secondField: {type: "string"}
                        }
                    },
                    anotherObject: {
                        type: "object",
                        properties: {secondField: {type: "string"}}
                    }
                }
            });

            const secondarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    firstObject: {
                        type: "object",
                        properties: {
                            firstField: {type: "string"},
                            secondField: {type: "string"}
                        }
                    }
                }
            });

            const differenceSchema = primarySchema.difference(secondarySchema);

            // Make sure firstObject does not show up in variablePaths
            assert.equal(differenceSchema.allVariablePaths.indexOf(".firstObject"), -1);
        });


        it("should eliminate array schemas who's items are left with no properties", function()
        {
            const primarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    firstField: {type: "string"},
                    firstArray: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                secondField: {type: "string"},
                                thirdField: {type: "string"}
                            }
                        }
                    }
                }
            });

            const secondarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    firstArray: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                secondField: {type: "string"},
                                thirdField: {type: "string"}
                            }
                        }
                    }
                }
            });

            const differenceSchema = primarySchema.difference(secondarySchema);

            // Make sure firstObject does not show up in variablePaths
            assert.equal(differenceSchema.allVariablePaths.indexOf(".firstArray"), -1);
        });


        it("should recurse into array schemas", function()
        {
            const primarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    firstArray: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                firstField: {type: "string"},
                                commonField: {type: "string"}
                            }
                        }
                    }
                }
            });

            const secondarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    firstArray: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                secondField: {type: "string"},
                                commonField: {type: "string"}
                            }
                        }
                    }
                }
            });

            const differenceSchema = primarySchema.difference(secondarySchema);

            assert.deepEqual(differenceSchema.allVariablePaths, [
                "",
                ".firstArray",
                ".firstArray.[]",
                ".firstArray.[].firstField"
            ]);
        });
    });

    describe("EBSchema.union()", function()
    {
        it("should throw an error for unions between two schema objects of different types", function()
        {
            const primarySchema = new models.EBSchema({type: "string"});
            const secondarySchema = new models.EBSchema({type: "number"});

            assert.throws(function()
            {
                primarySchema.union(secondarySchema);
            });
        });


        it("should return a schema containing fields from both schemas", function()
        {
            const primarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    first: {type: "string"},
                    common: {type: "string"}
                }
            });

            const secondarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    second: {type: "string"},
                    common: {type: "string"}
                }
            });

            const unionSchema = primarySchema.union(secondarySchema);

            assert.deepEqual(unionSchema.allVariablePaths, [
                "",
                ".common",
                ".first",
                ".second"
            ]);
        });


        it("should recurse into sub object schemas and compute their unions as well", function()
        {
            const primarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    firstObject: {
                        type: "object",
                        properties: {
                            firstField: {type: "string"},
                            commonField: {type: "string"}
                        }
                    },
                    anotherObject: {
                        type: "object",
                        properties: {secondField: {type: "string"}}
                    }
                }
            });

            const secondarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    firstObject: {
                        type: "object",
                        properties: {
                            commonField: {type: "string"},
                            secondField: {type: "string"}
                        }
                    }
                }
            });

            const unionSchema = primarySchema.union(secondarySchema);

            assert.deepEqual(unionSchema.allVariablePaths, [
                "",
                ".anotherObject",
                ".anotherObject.secondField",
                ".firstObject",
                ".firstObject.commonField",
                ".firstObject.firstField",
                ".firstObject.secondField"
            ]);
        });


        it("should recurse into array schemas and compute their unions as well", function()
        {
            const primarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    firstArray: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                firstField: {type: "string"},
                                commonField: {type: "string"}
                            }
                        }
                    }
                }
            });

            const secondarySchema = new models.EBSchema({
                type: "object",
                properties: {
                    firstArray: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                secondField: {type: "string"},
                                commonField: {type: "string"}
                            }
                        }
                    }
                }
            });

            const unionSchema = primarySchema.union(secondarySchema);

            assert.deepEqual(unionSchema.allVariablePaths, [
                "",
                ".firstArray",
                ".firstArray.[]",
                ".firstArray.[].commonField",
                ".firstArray.[].firstField",
                ".firstArray.[].secondField"
            ]);
        });
    });


    describe("EBSchema.generateCapnProtoSchema()", function()
    {
        it("should generate a valid CapnProto schema file", function()
        {
            const schema = comboUserSchemaList;

            const capnProtoSchema = schema.generateCapnProtoSchema("ComboUser", "@0xd50a23c935916122");

            const expected = `@0xd50a23c935916122;

struct Password {
    hashMethod @0 :Text;
    hashValue @1 :Text;
}
struct Users {
    password @0 :Password;
    age @1 :Float32;
    dead @2 :Bool;
    image @3 :Data;
    name @4 :Text;
    status @5 :Text;
}
struct ComboUser {
    users @0 :List(Users);
}`;

            assert.equal(capnProtoSchema, expected);

        });
    });

    describe("EBSchema.transformObject()", function()
    {
        it("should eliminate fields when the iterator function returns undefined", function()
        {
            const schema = comboUserSchemaList;

            const object = {
                users: [
                    {
                        age: 25,
                        dead: false,
                        image: new Buffer(""),
                        name: "brad",
                        status: "deleted",
                        password: {
                            hashMethod: "sha256",
                            hashValue: "abc123"
                        }
                    },
                    {
                        age: 35,
                        dead: true,
                        image: new Buffer(""),
                        name: "tim",
                        status: "active",
                        password: {
                            hashMethod: "sha256",
                            hashValue: "efg456"
                        }
                    }
                ]
            };

            const transformedObject = schema.transformObject(object, function(key, value, schema, parent, parentSchema)
            {
                if (schema.isString)
                {
                    return undefined;
                }
                else
                {
                    return value;
                }
            });

            assert.equal(transformedObject.users.length, 2);
            assert.deepEqual(Object.keys(transformedObject.users[0]), [
                'age',
                'dead',
                'image'
            ]);
            assert.deepEqual(Object.keys(transformedObject.users[1]), [
                'age',
                'dead',
                'image'
            ]);
        });


        it("should allow transforming values into completely different values", function()
        {
            const schema = comboUserSchemaList;

            const object = {
                users: [
                    {
                        age: 25,
                        dead: false,
                        image: new Buffer(""),
                        name: "brad",
                        status: "deleted",
                        password: {
                            hashMethod: "sha256",
                            hashValue: "abc123"
                        }
                    },
                    {
                        age: 35,
                        dead: true,
                        image: new Buffer(""),
                        name: "tim",
                        status: "active",
                        password: {
                            hashMethod: "sha256",
                            hashValue: "efg456"
                        }
                    }
                ]
            };

            const transformedObject = schema.transformObject(object, function(key, value, schema, parent, parentSchema)
            {
                if (schema.isString)
                {
                    return 42;
                }
                else
                {
                    return value;
                }
            });

            assert.equal(transformedObject.users.length, 2);
            assert.deepEqual(Object.keys(transformedObject.users[0]), [
                'age',
                'dead',
                'image',
                "name",
                "password",
                "status"
            ]);
            assert.deepEqual(Object.keys(transformedObject.users[1]), [
                'age',
                'dead',
                'image',
                "name",
                "password",
                "status"
            ]);

            assert.equal(transformedObject.users[0].age, 25);
            assert.equal(transformedObject.users[0].dead, false);
            assert.equal(transformedObject.users[0].image.toString(), new Buffer("").toString());
            assert.equal(transformedObject.users[0].name, 42);
            assert.equal(transformedObject.users[0].status, 42);
            assert.equal(transformedObject.users[0].password.hashMethod, 42);
            assert.equal(transformedObject.users[0].password.hashValue, 42);

            assert.equal(transformedObject.users[1].age, 35);
            assert.equal(transformedObject.users[1].dead, true);
            assert.equal(transformedObject.users[1].image.toString(), new Buffer("").toString());
            assert.equal(transformedObject.users[1].name, 42);
            assert.equal(transformedObject.users[1].status, 42);
            assert.equal(transformedObject.users[1].password.hashMethod, 42);
            assert.equal(transformedObject.users[1].password.hashValue, 42);
        });
    });
});
