//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//
'use strict';
import ng = angular;
import ngr = angular.ui;
export class ConfigRouter {
    public configure($stateProvider: ngr.IStateProvider, $urlRouterProvider: ngr.IUrlRouterProvider): void {
        $urlRouterProvider.otherwise('/');
        $stateProvider.state('home', {
            url: '/',
            templateUrl: 'Views/Home.html',
            controller: 'HomeController'
        }).state('analyze', {
            url: '/Analyze',
            templateUrl: 'Views/Analyze.html',
            controller: 'AnalysisController'
        }).state('results', {
            //url: '/Results',
            templateUrl: 'Views/AnalysisResults.html',
            controller: 'AnalysisResultsController'
        });
    }
}