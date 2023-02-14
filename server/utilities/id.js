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
 * This method is used for getting convenient, human readable ids for objects within Mongo.
 *
 * These ids will start at 0 and automatically increment, in a manner that is typical of
 * relational databases.
 *
 * @param {EBApplicationBase} A global EBApplication object
 * @param {string} collectionName The name of the collection to get the ID for
 * @param {function(err, id)} callback The function to receive the results when its complete
 */
module.exports.getUniqueID = function(application, collectionName, callback)
{
    application.db.collection('counters').findOneAndUpdate({_id: collectionName}, {$inc: {seq: 1}}, {}, function(err, counter)
    {
        if (err)
        {
            return callback(err);
        }
        else if (!counter.value)
        {
            application.db.collection('counters').insert({
                _id: collectionName,
                seq: 1
            }, function(err, inserted)
            {
                if (err)
                {
                    return callback(err);
                }

                return callback(null, 1);
            });
        }
        else
        {
            return callback(null, counter.value.seq + 1);
        }
    });
}