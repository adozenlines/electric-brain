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


angular.module('eb').controller('EBTransformArchitectureSelectFieldsController', function EBTransformArchitectureSelectFieldsController($scope, $timeout, $state, $stateParams, EBDataSourceService, config, EBArchitectureService, EBLoaderService)
{
    $scope.$watch('architecture', function(newValue, oldValue)
    {
        if (newValue)
        {
            if ($scope.schemaNeedsRefreshed || (!$scope.architecture.inputSchema || !$scope.architecture.outputSchema))
            {
                const originalInputSchema = $scope.architecture.inputSchema;
                $scope.architecture.inputSchema = new shared.models.EBSchema($scope.architecture.dataSource.dataSchema.filterIncluded()).clone();
                if (originalInputSchema)
                {
                    $scope.architecture.inputSchema.copyConfigurationFrom(originalInputSchema);
                }
                else
                {
                    $scope.architecture.inputSchema.walk((field) =>
                    {
                        field.setIncluded(false);
                    });
                }

                const originalOutputSchema = $scope.architecture.outputSchema;
                $scope.architecture.outputSchema = new shared.models.EBSchema($scope.architecture.dataSource.dataSchema.filterIncluded()).clone();
                if (originalOutputSchema)
                {
                    $scope.architecture.outputSchema.copyConfigurationFrom(originalOutputSchema);
                }
                else
                {
                    $scope.architecture.outputSchema.walk((field) =>
                    {
                        field.setIncluded(false);
                    });
                }
            }
        }
    });
});
