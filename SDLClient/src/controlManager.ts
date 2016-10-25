//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//
'use strict';
import clientCtrlModule = require('clientController');
import serviceModule = require('serviceHandler');
import routerModule = require('configRouter');
import homeCtrlModule = require('homeController');
import analysisCtrlModule = require('analysisController');
import analysisStateSvcModule = require('analysisStateService');
import analysisRsltsModule = require('analysisResultsController');

export class ControlManager {
    $parse: any;
    constructor(io: any) {
        var app = angular.module('ControlManager', ['ngAnimate', 'ui.router', 'ui.bootstrap']);
        var router = new routerModule.ConfigRouter();
        app.config(['$stateProvider', '$urlRouterProvider', router.configure]);

        var serviceHandler = new serviceModule.ServiceHandler();
        var serviceMod = app.factory('services', ['$http', '$cacheFactory', serviceModule.ExportService]);
        var analysisStateService = app.service('analysisState', analysisStateSvcModule.AnalysisStateService);
        app.controller('ClientController', ['$rootScope', '$scope', '$state', '$location', 'services',
            ($rootScope, $scope, $state, $location, services) =>
                new clientCtrlModule.ClientController($rootScope, $scope, $state, $location, services, serviceHandler, io)]);
        app.controller('HomeController', ['$scope', '$state', 'analysisState',
            ($scope, $state, analysisState) => new homeCtrlModule.HomeController($scope, $state, analysisState, serviceHandler)]);
        app.controller('AnalysisController', ['$scope', '$state', 'analysisState',
            ($scope, $state, analysisState) => new analysisCtrlModule.AnalysisController($scope, $state, analysisState, serviceHandler)]);
        app.controller('AnalysisResultsController', ['$scope', '$state', 'analysisState', ($scope, $state, analysisState) =>
            new analysisRsltsModule.AnalysisResultsController($scope, $state, analysisState, serviceHandler)]);

        //var self = this;

        //app.controller('ModalInstanceCtrl', function ($scope, $uibModalInstance) {
        //    console.log('Nothing');
        //});

        //app.directive('resizable', () => {
        //    return {
        //        restrict: 'E',
        //        link: (scope: ng.IScope, elem: any, attrs: any) => {
        //            $(elem).resizable({
        //                handles: 'e',
        //                create: (event, ui) => {
        //                    $('.ui-resizable-e').css('cursor', 'col-resize');
        //                },
        //                resize: function (event, ui) {
        //                    console.warn('Width --------------- ' + ui.size.width);
        //                    ui.size.height = ($('#buildCtr') && $('#buildCtr').height()) || ui.size.height;
        //                    $('#analysisCtr').height(ui.size.height);
        //                }
        //                //animate: true,
        //                //ghost: true
        //            });
        //        }
        //    };
        //});

        //app.filter('startFrom', () => {
        //    return (input, start) => {
        //        start = +start; //parse to int
        //        if (input) {
        //            return input.slice(start);
        //        }
        //    };
        //});
    }

}