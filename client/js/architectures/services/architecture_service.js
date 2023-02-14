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


angular.module('eb').service('EBArchitectureService', function EBArchitectureService($rootScope, $http, $timeout)
{
    const service = {};

    service.createArchitecture = function createArchitecture(data)
    {
        const headers = {};
        return $http({
            method: 'POST',
            url: '/api/architectures',
            headers,
            data
        });
    };

    service.getArchitectures = function getArchitectures(query)
    {
        const headers = {};
        return $http({
            method: 'GET',
            url: '/api/architectures',
            headers,
            params: query,
            transformResponse(data, headersGetter, status)
            {
                return {architectures: _.map(JSON.parse(data).architectures, (architecture) => shared.components.EBClassFactory.createObject(architecture))};
            }
        });
    };

    service.getArchitecture = function getArchitecture(id)
    {
        const headers = {};
        return $http({
            method: 'GET',
            url: `/api/architectures/${id}`,
            headers,
            transformResponse(data, headersGetter, status)
            {
                return shared.components.EBClassFactory.createObject(JSON.parse(data));
            }
        });
    };

    service.saveArchitecture = function saveArchitecture(architecture)
    {
        const headers = {};
        return $http({
            method: 'PUT',
            url: `/api/architectures/${architecture._id}`,
            headers,
            data: architecture
        });
    };

    service.deleteArchitecture = function deleteArchitecture(architecture)
    {
        const headers = {};
        return $http({
            method: 'DELETE',
            url: `/api/architectures/${architecture._id}`,
            headers
        });
    };

    service.getTransformedSample = function getTransformedSample(id)
    {
        const headers = {};
        return $http({
            method: 'GET',
            url: `/api/architectures/${id}/sample/transform`,
            headers,
            transformResponse(data, headersGetter, status)
            {
                return JSON.parse(data);
            }
        });
    };

    service.getNetworkDiagrams = function getNetworkDiagrams(id)
    {
        const headers = {};
        return $http({
            method: 'GET',
            url: `/api/architectures/${id}/diagrams`,
            headers,
            transformResponse(data, headersGetter, status)
            {
                return JSON.parse(data);
            }
        });
    };

    return service;
});
