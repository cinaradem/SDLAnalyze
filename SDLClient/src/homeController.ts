//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//
'use strict';
import ng = angular;
import ngr = angular.ui;
import serviceModule = require('serviceHandler');
import analysisStateSvcModule = require('analysisStateService');

export class HomeController {
    state: ngr.IStateService;
    serviceFactory: serviceModule.ServiceHandler;
    analysisStateMgr: analysisStateSvcModule.AnalysisStateService;
    parent: any;
    analyzedItems: Array<any> = [];

    constructor($scope: ng.IScope, $state: ngr.IStateService,
        analysisStateMgr: analysisStateSvcModule.AnalysisStateService, serviceClass: serviceModule.ServiceHandler) {
        this.serviceFactory = serviceClass;
        this.state = $state;
        this.parent = $scope.$parent;
        this.analysisStateMgr = analysisStateMgr;
    }
}