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


angular.module('eb').service('EBModelService', function EBModelService($rootScope, $http, $timeout)
{
    const service = {};

    service.createModel = function createModel(data)
    {
        const headers = {};
        return $http({
            method: 'POST',
            url: '/api/models',
            headers,
            data
        });
    };

    service.getModels = function getModels(query)
    {
        const headers = {};
        return $http({
            method: 'GET',
            url: '/api/models',
            headers,
            params: query,
            transformResponse(data, headersGetter, status)
            {
                return {models: _.map(JSON.parse(data).models, (model) => new shared.models.EBModel(model))};
            }
        });
    };

    service.getModel = function getModel(id)
    {
        const headers = {};
        return $http({
            method: 'GET',
            url: `/api/models/${id}`,
            headers,
            transformResponse(data, headersGetter, status)
            {
                return new shared.models.EBModel(JSON.parse(data));
            }
        });
    };

    service.getModelResults = function getModelResults(id)
    {
        const headers = {};
        return $http({
            method: 'GET',
            url: `/api/models/${id}/results`,
            headers,
            json: true
        });
    };

    service.saveModel = function saveModel(model)
    {
        const headers = {};
        return $http({
            method: 'PUT',
            url: `/api/models/${model._id}`,
            headers,
            data: model
        });
    };

    service.trainModel = function trainModel(model)
    {
        const headers = {};
        return $http({
            method: 'POST',
            url: `/api/models/${model._id}/train`,
            headers,
            data: model
        });
    };

    service.deleteModel = function deleteModel(model)
    {
        const headers = {};
        return $http({
            method: 'PUT',
            url: `/api/models/${model._id}`,
            headers
        });
    };

    service.processObjectWithModel = function processObjectWithModel(model, object)
    {
        const headers = {};
        return $http({
            method: 'GET',
            params: {data: object},
            url: `/api/models/${model._id}/process`,
            headers
        });
    };

    service.computeChartDataForModel = function computeChartDataForModel(model, variable)
    {
        if (!model.training.iterations)
        {
            return [];
        }

        // Create chart data by averaging losses over a dozen iterations
        let iterationsToAverage = 10;
        if (model.training.iterations.length > 5000)
        {
            iterationsToAverage = 500;
        }
        else if (model.training.iterations.length > 1500)
        {
            iterationsToAverage = 100;
        }
        else if (model.training.iterations.length > 500)
        {
            iterationsToAverage = 50;
        }
        else if (model.training.iterations.length > 200)
        {
            iterationsToAverage = 20;
        }

        const numberOfDataPoints = Math.floor(model.training.iterations.length / iterationsToAverage);
        const data = [];
        for (let dataPointIndex = 0; dataPointIndex < numberOfDataPoints; dataPointIndex += 1)
        {
            const dataPoint = {
                x: (dataPointIndex + 1) * iterationsToAverage,
                y: _.reduce(model.training.iterations.slice(dataPointIndex * iterationsToAverage, (dataPointIndex + 1) * iterationsToAverage), function(memo, iteration)
                {
                    if (variable === 'accuracy')
                    {
                        return memo + Number((iteration[variable] * 100).toFixed(1));
                    }
                    else
                    {
                        return memo + Number(iteration[variable].toFixed(2));
                    }
                }, 0) / iterationsToAverage
            };

            data.push(dataPoint);
        }
        return data;
    };

    service.assembleBundle = function assembleBundle(model)
    {
        const headers = {};
        return $http({
            method: 'POST',
            url: `/api/models/${model._id}/assemble_bundle`,
            headers,
            data: model
        });
    };

    return service;
});
