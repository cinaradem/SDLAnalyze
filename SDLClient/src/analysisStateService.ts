//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//
'use strict';
export class AnalysisStateService {
    builds: Array<any> = [];
    //builds: Array < any > = [
    //    { slnFile: 'EUS-IAM-Prvent-VSTSPS\\MS.IT.TeamFoundation.PowerShell\\MS.IT.TeamServices.PowerShell.sln' }];
    cloneInProgress: Array<any> = [];
    outputHeaders: Array<string>;
    outputCollection: Array<any>;
    projects: Array<any>;
}