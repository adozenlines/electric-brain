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
 * EB - controller
 */


angular.module('eb').controller('EBTransformArchitectureDesignArchitectureController', function EBTransformArchitectureDesignArchitectureController($scope, $timeout, $state, $stateParams, EBArchitectureService, EBLoaderService)
{
    $scope.currentDiagram = 0;
    function reloadDiagrams()
    {
        const promise = EBArchitectureService.saveArchitecture($scope.architecture).then(function()
        {
            return EBArchitectureService.getNetworkDiagrams($scope.architecture._id).success(function(data)
            {
                $scope.diagrams = null;
                $timeout(function()
                {
                    $scope.diagrams = data.diagrams;
                }, 10);
            });
        });

        EBLoaderService.showLoaderWith('menu', promise);
        return promise;
    }


    $scope.$watch('architecture', function(newValue, oldValue)
    {
        if (newValue)
        {
            reloadDiagrams();
        }
    });

    $scope.reloadDiagrams = reloadDiagrams;
});
