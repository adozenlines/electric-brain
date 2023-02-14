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
angular.module('eb').controller('EBNewModelController', function EBNewModelControlle($scope, $stateParams, $state, EBModelService, EBNavigationBarService, EBSocketService)
{
    $scope.model = new shared.models.EBModel({"name": ""});

    $scope.onArchitectureClicked = function onArchitectureClicked()
    {
        if (!$scope.model.name)
        {
            $scope.model.name = `${$scope.model.architecture.name} - ${moment().format('MMM D, hh:mm A')}`;
        }
    };

    $scope.onTrainModelClicked = function onTrainModelClicked()
    {
        return EBModelService.createModel($scope.model).then(function success(body)
        {
            EBNavigationBarService.refreshNavigationBar();
            
            const id = body.data._id;
            return EBModelService.trainModel(body.data).then(function success(body)
            {
                $state.go('view_model', {id: id});
            });
        });
    };

    $scope.$watch('model.parameters.optimizationAlgorithm', function(newValue, oldValue)
    {
        if (newValue)
        {
            const optimFunction = _.find($scope.optimizationAlgorithms, (func) => func.name === newValue);

            console.log(newValue)
            console.log(optimFunction)
            $scope.model.parameters.optimizationParameters = _.clone(optimFunction.parameters);
        }
    });

    $scope.optimizationAlgorithms = [
        {
            "name": "sgd",
            "title": "Stochastic Gradient Descent",
            "parameters": {
                "learningRate": 1e-3,
                "learningRateDecay": 0,
                "weightDecay": 0,
                "momentum": 0,
                "dampening": 0,
                "nesterov": 0
            }
        },
        {
            "name": "asgd",
            "title": "Averaged Stochastic Gradient Descent",
            "parameters": {
                "eta0": 1e-4,
                "lambda": 1e-4,
                "alpha": 0.75,
                "t0": 1e6
            }
        },
        {
            "name": "cg",
            "title": "Conjugate Gradient",
            "parameters": {
                "rho": 0.01,
                "sig": 0.5,
                "int": 0.1,
                "ext": 3.0,
                "maxIter": 20,
                "ratio": 100,
                "maxEval": 25
            }
        },
        {
            "name": "adadelta",
            "title": "AdaDelta",
            "parameters": {
                "rho": 0.9,
                "eps": 1e-6,
                "weightDecay": 0
            }
        },
        {
            "name": "adagrad",
            "title": "AdaGrad",
            "parameters": {
                "learningRate": 1e-3,
                "learningRateDecay": 0,
                "weightDecay": 0
            }
        },
        {
            "name": "adam",
            "title": "Adam",
            "parameters": {
                "learningRate": 1e-3,
                "learningRateDecay": 0,
                "beta1": 0.9,
                "beta2": 0.999,
                "epsilon": 1e-8,
                "weightDecay": 0
            }
        },
        {
            "name": "adamax",
            "title": "AdaMax",
            "parameters": {
                "learningRate": 2e-3,
                "beta1": 0.9,
                "beta2": 0.999,
                "epsilon": 1e-38,
                "weightDecay": 0
            }
        },
        {
            "name": "nag",
            "title": "Nesterov's Accelerated Gradient",
            "parameters": {
                "learningRate": 1e-3,
                "learningRateDecay": 0,
                "weightDecay": 0,
                "momentum": 0.9,
                "dampening": 0.9
            }
        },
        {
            "name": "rmsprop",
            "title": "RMSProp",
            "parameters": {
                "learningRate": 1e-2,
                "alpha": 0.99,
                "epsilon": 1e-8,
                "weightDecay": 0,
                "initialMean": 0
            }
        },
        {
            "name": "rprop",
            "title": "RProp",
            "parameters": {
                "stepsize": 0.1,
                "etaplus": 1.2,
                "etaminus": 0.5,
                "stepsizemax": 50,
                "stepsizemin": 1e-6,
                "niter": 1
            }
        }
    ];
    
});
