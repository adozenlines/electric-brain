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


angular.module('eb').controller('EBMatchingArchitectureSelectFieldsController', function EBMatchingArchitectureSelectFieldsController($scope, $timeout, $state, $stateParams, EBDataSourceService, config, EBArchitectureService, EBLoaderService)
{
    $scope.$watch('architecture', function(newValue, oldValue)
    {
        if (newValue)
        {
            if ($scope.schemaNeedsRefreshed || (!$scope.architecture.primarySchema || !$scope.architecture.secondarySchema || !$scope.architecture.linkagesSchema))
            {
                const originalPrimarySchema = $scope.architecture.primarySchema;
                $scope.architecture.primarySchema = new shared.models.EBSchema($scope.architecture.primaryDataSource.dataSchema.filterIncluded()).clone();
                if (originalPrimarySchema)
                {
                    $scope.architecture.primarySchema.copyConfigurationFrom(originalPrimarySchema);
                }
                else
                {
                    $scope.architecture.primarySchema.walk((field) =>
                    {
                        field.setIncluded(false);
                    });
                }

                const originalSecondarySchema = $scope.architecture.secondarySchema;
                $scope.architecture.secondarySchema = new shared.models.EBSchema($scope.architecture.secondaryDataSource.dataSchema.filterIncluded()).clone();
                if (originalSecondarySchema)
                {
                    $scope.architecture.secondarySchema.copyConfigurationFrom(originalSecondarySchema);
                }
                else
                {
                    $scope.architecture.secondarySchema.walk((field) =>
                    {
                        field.setIncluded(false);
                    });
                }

                const originalLinkagesSchema = $scope.architecture.linkagesSchema;
                $scope.architecture.linkagesSchema = new shared.models.EBSchema($scope.architecture.linkagesDataSource.dataSchema.filterIncluded()).clone();
                if (originalLinkagesSchema)
                {
                    $scope.architecture.linkagesSchema.copyConfigurationFrom(originalLinkagesSchema);
                }
                else
                {
                    $scope.architecture.linkagesSchema.walk((field) =>
                    {
                        field.setIncluded(false);
                    });
                }
            }
        }
    });
});
