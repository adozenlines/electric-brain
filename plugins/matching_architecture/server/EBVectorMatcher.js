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

const cosineSimilarity = require( 'compute-cosine-similarity' ),
    underscore = require('underscore');

/**
 * This class is used for matching primary to secondary objects in production
 */
class EBVectorMatcher
{
    /**
     * Creates an empty vector matcher
     */
    constructor()
    {
        this.primaryVectors = {};
        this.secondaryVectors = {};
    }

    /**
     * This method stores a primary vector with the given ID. This can be used to returning the matching objects for
     * a secondary vector.
     *
     * @param {string} id The ID for the object which this primary vector was computed for
     * @param {[number]} primaryVector An array of numbers representing the vector.
     */
    recordPrimaryVector(id, primaryVector)
    {
        this.primaryVectors[id] = primaryVector;
    }

    /**
     * This method stores a secondary vector with the given ID. This can be used to returning the matching objects for
     * a primary vector.
     *
     * @param {string} id The ID for the object which this secondary vector was computed for
     * @param {[number]} secondaryVector An array of numbers representing the vector.
     */
    recordSecondaryVector(id, secondaryVector)
    {
        this.secondaryVectors[id] = secondaryVector;
    }

    /**
     * This takes a primary vector and returns the closest N matching secondary vectors
     *
     * @param {[number]} primaryVector An array of numbers representing the vector.
     * @param {[number]} count The number of secondary vectors to return
     * @return {[object]} objects containing two variables
     */
    findMatchingSecondary(primaryVector, count)
    {
        // Go through all the secondary vectors and find the closest one
        const secondaries = Object.keys(this.secondaryVectors).map((id) => {
            return {
                id: id,
                distance: (1.0 - cosineSimilarity(primaryVector, this.secondaryVectors[id]))
            };
        });

        const sortedSecondaries = underscore.sortBy(secondaries, (secondary) => secondary.distance);
        return sortedSecondaries.slice(0, count);
    }

    /**
     * This takes a primary vector and returns the closest matching primary vector
     *
     * @param {[number]} secondaryVector An array of numbers representing the vector.
     * @param {[number]} count The number of secondary vectors to return
     * @return {[object]} objects containing two variables
     */
    findMatchingPrimary(secondaryVector, count)
    {
        // Go through all the secondary vectors and find the closest one
        const primaries = Object.keys(this.primaryVectors).map((id) => {
            return {
                id: id,
                distance: (1.0 - cosineSimilarity(secondaryVector, this.primaryVectors[id]))
            };
        });

        const sortedPrimaries = underscore.sortBy(primaries, (primary) => primary.distance);
        return sortedPrimaries.slice(0, count);
    }

}


module.exports = EBVectorMatcher;