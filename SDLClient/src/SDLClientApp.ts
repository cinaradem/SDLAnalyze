//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//
'use strict';
import ctrlManagerModule = require('controlManager');

export class SDLClientApp {
    constructor(io : any) {
        var ngApp = angular.module('SDLClientApp', ['ControlManager']);
        var mainCtrls = new ctrlManagerModule.ControlManager(io);
    }
}