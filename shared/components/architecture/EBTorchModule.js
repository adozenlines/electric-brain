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
    underscore = require('underscore');

/**
 *  This class represents a torch nn module
 */
class EBTorchModule
{
    /**
     * This creates a new torch module
     *
     * @param {string} torchClass The name of the neural network module
     * @param {[string]} [parameters] An optional array of strings with all of the parameters for the torch nodes
     * @param {[EBTorchModule]} [children] An optional array containing any children modules to add
     */
    constructor(torchClass, parameters, children)
    {
        const self = this;
        self.torchClass = torchClass;
        assert(torchClass);

        if (parameters)
        {
            self.parameters = parameters;
            underscore.each(parameters, (param) => assert(param !== null && param !== undefined));
        }
        else
        {
            self.parameters = [];
        }
        
        if (children)
        {
            self.children = children;
        }
        else
        {
            self.children = [];
        }
    }

    /**
     * Adds a node as a child of this one. It will be added to the end of the list of children
     *
     * @param {EBTorchModule} child The child module to be added.
     */
    addChildModule(child)
    {
        this.children.push(child);
    }


    /**
     * Returns the lua code which can declare this module
     *
     * @param {string} [indent] An optional string for how much indentation to add to new lines
     */
    generateLuaCode(indent)
    {
        const self = this;
        
        if (!indent)
        {
            indent = "";
        }

        const parameters = underscore.map(self.parameters, function(param)
        {
            if (param instanceof EBTorchModule)
            {
                return param.generateLuaCode(`${indent}    `);
            }
            else
            {
                return param.toString();
            }
        }).join(", ");

        let children = underscore.map(self.children, function(child)
        {
            return `\n${indent}        :add(${child.generateLuaCode(`${indent}    `)})`;
        }).join('');

        if (children)
        {
            children += `\n${indent}    `;
        }

        return `${self.torchClass}(${parameters})${children}`;
    }
}

module.exports = EBTorchModule;
