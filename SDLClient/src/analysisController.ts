//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//
'use strict';
import ng = angular;
import ngr = angular.ui;
import serviceModule = require('serviceHandler');
import analysisStateSvcModule = require('analysisStateService');

export class AnalysisController {
    scope: ng.IScope;
    state: ngr.IStateService;
    serviceFactory: serviceModule.ServiceHandler;
    parent: any;
    gitUrl: string;
    cloneMessages: Array<string> = ['Cloning ...', 'Success', 'Error'];
    buildMessages: Array<string> = [];
    analysisStateMgr: analysisStateSvcModule.AnalysisStateService;

    constructor($scope: ng.IScope, $state: ngr.IStateService,
        analysisStateMgr: analysisStateSvcModule.AnalysisStateService,
        serviceClass: serviceModule.ServiceHandler) {
        this.scope = $scope;
        this.serviceFactory = serviceClass;
        this.state = $state;
        this.parent = $scope.$parent;
        this.analysisStateMgr = analysisStateMgr;
    }

    isOpen = () => {
        return this.analysisStateMgr.builds.length > 0;
    }

    solutionsToBuild = (index: number): Array<any> => {
        var clonedSolutions = this.analysisStateMgr.cloneInProgress[index].clonedSolutions;
        return clonedSolutions ? clonedSolutions.filter((s) => { return s.build === true; }) : null;
    }

    noSlnSelected = (index: number): boolean => {
        var tobeBuilt = this.solutionsToBuild(index);
        return tobeBuilt ? tobeBuilt.length === 0 : true;
    }

    cloneRepository = () => {
        console.log(this.gitUrl);
        var self = this;
        self.parent.ctrl.dataReady = false;
        var serverUpdateHandler = (data) => {
            var uri = data.cloneUri;
            var cloneInProgress = self.analysisStateMgr.cloneInProgress;
            console.log(data);
            if (uri && cloneInProgress && cloneInProgress.length) {
                var index = -1;
                self.analysisStateMgr.cloneInProgress.forEach((val: any, ind: number) => {
                    if (decodeURIComponent(val.uri) === uri) {
                        index = ind;
                    }
                });

                if (Array.isArray(data.clonedSolutions)) {
                    self.analysisStateMgr.cloneInProgress[index].status = 1;
                    self.analysisStateMgr.cloneInProgress[index].clonedSolutions = [];
                    self.analysisStateMgr.cloneInProgress[index].logFD = data.logFile;
                    data.clonedSolutions.forEach((val: any, ind: number) => {
                        self.analysisStateMgr.cloneInProgress[index].clonedSolutions.push({
                            slnFile: val,
                            build : false
                        });
                    });
                } else if (data.Message && data.ExceptionMessage) {
                    self.analysisStateMgr.cloneInProgress[index].status = 2;
                    self.parent.ctrl.message = data.Message + ';' + JSON.stringify(data.ExceptionMessage);
                }

                self.scope.$digest();
            }
        };

        this.serviceFactory.cloneRepository(this.gitUrl).then((response: any) => {
            if (response.status === 200) {
                var messageId = response.data;
                var index: number = -1;
                self.analysisStateMgr.cloneInProgress.forEach((val: any, ind: number) => {
                    if (val.uri === self.gitUrl) {
                        index = ind;
                    }
                });
                if (index !== -1) { self.analysisStateMgr.cloneInProgress.splice(index, 1); }
                self.analysisStateMgr.cloneInProgress.push({ uri: self.gitUrl, status: 0 });
                self.gitUrl = '';
                self.listenServerUpdates(messageId, serverUpdateHandler);
            }
        }).catch((reason: any) => {
            if (reason.data) {
                if (typeof (reason.data) === 'string') {
                    self.parent.ctrl.message = reason.data;
                } else if (reason.data.Message && reason.data.ExceptionMessage) {
                    self.parent.ctrl.message = reason.data.Message + ';' + JSON.stringify(reason.data.ExceptionMessage);
                } else {
                    self.parent.ctrl.message = 'Unknown Exception';
                }
            }
        }).finally(() => {
            self.parent.ctrl.dataReady = true;
        });
    };


    buildSoln = (id: number) => {
        var tobeBuilt = this.solutionsToBuild(id);
        var self = this;
        var paths = [];
        tobeBuilt.forEach((val: any, ind: number) => {
            var slnPath = val && val.slnFile;
            paths.push(slnPath);
            self.analysisStateMgr.builds.push({ slnFile: slnPath });
        });

        //var slnPath = tobeBuilt && tobeBuilt[0].slnFile;
        //this.analysisStateMgr.builds.push({ slnFile: slnPath});
        this.buildSolution(paths);
    };

    listenServerUpdates = (messageId: string, callabck: Function) => {
        var client = this.parent.ctrl.socket;
        client.on(messageId, function (data) {
            callabck(data);
            //console.log(data);
            //       client.emit('my other event', { my: data });
        });
    }

    analyze = (id: number) => {
        if (this.analysisStateMgr.builds && Array.isArray(this.analysisStateMgr.builds) && this.analysisStateMgr.builds.length > id) {
            var selectedBuild = this.analysisStateMgr.builds[id];
            var slnPath = selectedBuild.slnFile;
            this.runAnalysis(slnPath);
        }
    };

    buildSolution = (slnPaths : Array<string>) => {
        var self = this;
        //self.parent.ctrl.dataReady = false;
        //this.listenServerUpdates('news', (data) => { console.log(data); });
        var serverUpdateHandler = (data) => {
            var slnFile = data.slnFile;
            var builds = self.analysisStateMgr.builds;
            console.log(data);
            if (slnFile && builds && builds.length) {
                var index = -1;
                self.analysisStateMgr.builds.forEach((val: any, ind: number) => {
                    if (decodeURIComponent(val.slnFile) === slnFile) {
                        index = ind;
                    }
                });

                self.analysisStateMgr.builds[index].inProgress = false;
                if (data.logFile) {
                    self.analysisStateMgr.builds[index].logFD = data.logFile;
                } else if (data.Message && data.ExceptionMessage) {
                    self.parent.ctrl.message = data.Message + ';' + JSON.stringify(data.ExceptionMessage);
                }

                self.scope.$digest();
            }
        };
        slnPaths.forEach((slnPath: string, ind: number) => {
            console.log(slnPath);
            this.serviceFactory.buildSolution(slnPath).then((response: any) => {
                if (response.status === 200) {
                    var messageId = response.data;

                    //var bldMessages = response.data['result'];
                    //if (Array.isArray(bldMessages)) {
                    var index = -1;
                    self.analysisStateMgr.builds.forEach((val: any, ind: number) => {
                        if (decodeURIComponent(val.slnFile) === slnPath) {
                            index = ind;
                        }
                    });

                    if (index !== -1) {
                        self.analysisStateMgr.builds[index].inProgress = true;
                        self.listenServerUpdates(messageId, serverUpdateHandler);

                    }

                    //self.buildMessages = bldMessages;
                    //}
                }
            }).catch((reason: any) => {
                self.parent.ctrl.message = reason.data ? reason.data.Message + ';' +
                    JSON.stringify(reason.data.ExceptionMessage) : 'Unknown Exception';
            }).finally(() => {
                //self.parent.ctrl.dataReady = true;
            });
        });
    };

    runAnalysis = (slnPath: string) => {
        console.log(slnPath);
        this.analysisStateMgr.projects = [];
        this.analysisStateMgr.outputCollection = [];
        var self = this;
        self.parent.ctrl.dataReady = false;
        var serverUpdateHandler = (data) => {
            var index = -1;
            self.analysisStateMgr.builds.forEach((val: any, ind: number) => {
                if (decodeURIComponent(val.slnFile) === slnPath) {
                    index = ind;
                }
            });

            self.analysisStateMgr.builds[index].inProgress = false;
            if (data.Message && data.ExceptionMessage) {
                self.parent.ctrl.message = data.Message + ';' + JSON.stringify(data.ExceptionMessage);
            } else {
                var projects = data;
                if (Array.isArray(projects)) {
                    self.arrangeOutputs(projects);
                }
                self.state.go('results');
            }
        };

        this.serviceFactory.analyzeSolution(slnPath).then((response: any) => {
            if (response.status === 200) {
                var messageId = response.data;
                var index = -1;
                self.analysisStateMgr.builds.forEach((val: any, ind: number) => {
                    if (decodeURIComponent(val.slnFile) === slnPath) {
                        index = ind;
                    }
                });

                if (index !== -1) {
                    self.analysisStateMgr.builds[index].inProgress = true;
                    self.listenServerUpdates(messageId, serverUpdateHandler);

                }
            }
        }).catch((reason: any) => {
            self.parent.ctrl.message = reason.data ? reason.data.Message + ';' +
                JSON.stringify(reason.data.ExceptionMessage) : 'Unknown Exception';
        }).finally(() => {
            self.parent.ctrl.dataReady = true;
        });
    };

    splitOutputs = (out: string): Array<string> => {
        var splitOutput = out.split(' : ');
        return splitOutput;
    };

    arrangeOutputs = (projects: Array<any>): void => {
        var self = this;
        self.analysisStateMgr.outputHeaders = ['File', 'Severity', 'Code', 'Category', 'Description'];
        projects.forEach(p => {
            if (p.outputs) {
                var o = p.outputs;
                var properties: Array<string> = Object.getOwnPropertyNames(o);
                properties.forEach((assembly) => {
                    var output = { 'assembly': assembly, 'messages': [] };
                    var messages = o[assembly];

                    messages.forEach((message) => {
                        if (message.indexOf(': warning  :') !== -1 || message.indexOf(': error  :') !== -1) {
                            var splitMessage = self.splitOutputs(message);
                            var m = {};
                            splitMessage.forEach((val: string, index: number) => {
                                m[self.analysisStateMgr.outputHeaders[index]] = val;
                            });
                            output.messages.push(m);
                        }

                    });

                    self.analysisStateMgr.outputCollection.push(output);
                });
            }
        });

        self.analysisStateMgr.projects = projects;
    };
}