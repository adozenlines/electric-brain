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
angular.module('eb').controller('EBViewModelController', function EBViewModelController($scope, $stateParams, $state, EBModelService, EBNavigationBarService, EBSocketService, $timeout, EBDataSourceService, NgTableParams, EBViewTransformedObjectDialog, EBLoaderService)
{
    let log = "";

    $scope.activeTrainingChart = 0;
    $scope.activeTab = 0;

    const refreshView = function refreshView()
    {
        if (!$scope.model.training.iterations)
        {
            $scope.accuracyChartConfig.series[0].data = [];
            $scope.accuracyChartConfig.series[1].data = [];
            $scope.lossChartConfig.series[0].data = [];
            return;
        }

        $scope.accuracyChartConfig.series[0].data = EBModelService.computeChartDataForModel($scope.model, 'accuracy');
        $scope.accuracyChartConfig.series[1].data = EBModelService.computeChartDataForModel($scope.model, 'trainingAccuracy');
        $scope.lossChartConfig.series[0].data = EBModelService.computeChartDataForModel($scope.model, 'loss');
    };

    $scope.getModel = function getModel()
    {
        const promise = EBModelService.getModel($stateParams.id).success(function (model)
        {
            $scope.model = model;

            if ($scope.model.training.status !== 'waiting')
            {
                $scope.activeTab = 1;
            }
            else
            {
                $scope.activeTab = 0;
            }

            refreshView();
            setupEventHandler();
            setupModelAPIDocumentation();
            $scope.testInputSchema = model.architecture.inputSchema.filterIncluded();
        });
        EBLoaderService.showLoaderWith('page', promise);
    };

    let socketEventHandler = function (data)
    {
        $timeout(function ()
        {
            if (data.event === 'update')
            {
                // If we just started training, flip over to the graph
                if (data.model.training.status === 'in_progress' && $scope.model.training.status !== 'in_progress')
                {
                    $timeout(function ()
                    {
                        $scope.activeTab = 1;
                    }, 250);
                }

                $scope.model = new shared.models.EBModel(data.model);
                refreshView();
            }
        });
    };

    function setupEventHandler()
    {
        EBSocketService.socket.on(`model-${$stateParams.id}`, socketEventHandler);
    }

    function clearEventHandler()
    {
        EBSocketService.socket.removeListener(`model-${$stateParams.id}`, socketEventHandler);
    }

    $scope.$on('$destroy', function ()
    {
        clearEventHandler();
    });

    $scope.getModel();

    $scope.onDeleteClicked = function onDeleteClicked()
    {
        EBModelService.deleteModel($scope.model).then(function success(body)
        {
            EBNavigationBarService.refreshNavigationBar();
            $state.go('dashboard');
        });
    };

    $scope.objectClicked = function objectClicked(object)
    {
        EBViewTransformedObjectDialog.open($scope.model, object);
    };

    $scope.reflowCharts = function reflowCharts()
    {
        $timeout(function ()
        {
            $scope.$broadcast('highchartsng.reflow');
        }, 10);
    };

    $scope.accuracyChartConfig = {
        options: {
            chart: {type: 'line', zoomType: 'y'},
            tooltip: {
                style: {
                    padding: 10,
                    fontWeight: 'bold'
                }
            },
            yAxis: [{
                title: {text: 'Accuracy'},
                min: 0,
                max: 100
            }]
        },
        series: [{data: [], name: "Accuracy"},
            {data: [], name: "Training Accuracy"}],
        title: {text: 'Accuracy'},
        xAxis: {title: {text: 'iterations'}},
        size: {height: 600}
    };

    $scope.lossChartConfig = {
        options: {
            chart: {type: 'line', zoomType: 'y'},
            tooltip: {
                style: {
                    padding: 10,
                    fontWeight: 'bold'
                }
            },
            yAxis: [{
                title: {text: 'Loss'},
                min: 0
            }]
        },
        series: [{data: [], name: "Loss"}],
        title: {text: 'Loss'},
        xAxis: {title: {text: 'iterations'}},
        size: {height: 600}
    };

    function setupModelAPIDocumentation()
    {
        // console.log(JSON.parse(JSON.stringify($scope.model.architecture.inputSchema)));
        $scope.modelAPISpec = {
            "swagger": "2.0",
            "info": {
                "version": "0.0.1",
                "title": "Process data through your model"
            },
            "paths": {
                [`/models/${$stateParams.id}/process`]: {
                    "get": {
                        "description": "Allows you to process data through your model\n",
                        "parameters": [
                            {
                                "name": "data",
                                "in": "body",
                                "description": "Data to process through your model",
                                "required": true,
                                "schema": JSON.parse(JSON.stringify($scope.model.architecture.inputSchema))
                            }
                        ],
                        "responses": {
                            "200": {
                                "description": "Successful response",
                                "schema": {
                                    "title": "Output data",
                                    "type": "object",
                                    "properties": {
                                        "data": JSON.parse(JSON.stringify($scope.model.architecture.outputSchema))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };
    }

    $scope.testObject = {};
    $scope.testModel = function testModel()
    {
        EBModelService.processObjectWithModel($scope.model, $scope.testObject).then(function (response)
        {
            $scope.testResult = response.data;
        });
    };

    $scope.stopModel = function ()
    {
        EBSocketService.socket.emit(`command-model`, {command: 'kill', id: $stateParams.id});
    };

    $scope.assembleBundle = function ()
    {
        EBModelService.assembleBundle($scope.model).then(function (response)
        {
            // $scope.testResult = response.data;
        });
    };
});
