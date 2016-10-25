'use strict';

import express = require('express');
import Q = require('q');
import fs = require('fs');
import rl = require('readline');
import path = require('path');
import spawn = require('child_process');
import ut = require('./utils');
import jwt = require('./jwtManage');
import jsonwt = require('jsonwebtoken');
import base = require('./base');
import da = require('./dal');
import fl = require('./fileHandler');
var utils = ut.Utils;

export class SolutionBuilder extends base.Base {
    gitCloneRootFolder: string = 'C:\\GitRepos\\';
    //solutionPath: string = '';

    constructor(da: da.DataAccess) {
        super();
        this.dataAccess = da;
    }

    buildSolution = (): express.RequestHandler => {
        var self = this;
        return (req: express.Request, res: express.Response) => {
            jwt.JwtManager.authenticate(req.headers).then((decoded: any) => {
                var query = req.query;
                var id = decoded._id;
                console.warn('**************** id:', id);
                if (!id || !id.length) {
                    return res.status(401).json('No valid id exist for this user');
                }

                var solutionPath = query.solnPath;
                if (!solutionPath) {
                    return res.status(400).json({ Message: 'Solution path is expected.' });
                }

                solutionPath = path.join(self.gitCloneRootFolder, id, solutionPath);
                console.warn('Solution Path :' + solutionPath);

                var messageId = jsonwt.sign({ method: 'buildSolution' }, Date.now().toLocaleString());
                res.status(200).json(messageId);

                self.getVsVersionFromSolution(solutionPath).then((vsVersion: number) => {
                    self.restorePackages(solutionPath).then(() => {
                        self.build(vsVersion, solutionPath, id).then((buildResult: any) => {
                            var fd: fl.FileData = {
                                userId: id,
                                name: buildResult.log,
                                link: '/sdlserver/api/Files?userId=' +
                                id + '&fileName=' + buildResult.log +
                                '&token=' + jwt.JwtManager.getToken()
                            };

                            self.sendSocketMessage(messageId, { slnFile: query.solnPath, logFile: fd });
                        }).catch((ex: any) => {
                            self.sendSocketMessage(messageId, {
                                slnFile: query.solnPath,
                                Message: 'Error while building solution : ' + solutionPath,
                                ExceptionMessage: ex
                            });
                        });
                    }).catch((ex: any) => {
                        self.sendSocketMessage(messageId, {
                            slnFile: query.solnPath,
                            Message: 'Error restoring Packages',
                            ExceptionMessage: ex
                        });
                    });
                }).catch((ex: any) => {
                    self.sendSocketMessage(messageId, {
                        slnFile: query.solnPath,
                        Message: 'Error getting the Visual Studio version from solution',
                        ExceptionMessage: ex
                    });
                });

                //self.getVsVersionFromSolution().then((vsVersion: number) => {
                //    self.restorePackages().then(() => {
                //        self.build(vsVersion).then((result: any) => {
                //            res.status(200).json(result);
                //        }).catch((ex: any) => {
                //            return res.status(400).json({
                //                Message: 'Error while building solution : ' + self.solutionPath,
                //                ExceptionMessage: ex
                //            });
                //        });
                //    }).catch((ex: any) => {
                //        return res.status(400).json({
                //            Message: 'Error restoring Packages',
                //            ExceptionMessage: ex
                //        });
                //    });
                //}).catch((ex: any) => {
                //    return res.status(400).json({
                //        Message: 'Error getting the Visual Studio version from solution',
                //        ExceptionMessage: ex
                //    });
                //});
            }).catch((ex: any) => {
                console.warn('Error while authentication: ' + JSON.stringify(ex));
                return res.status(401).json('Failed to authenticate token.');
            });
        };
    }

    private getVsVersionFromSolution = (solutionPath: string): Q.Promise<any> => {
        var deferred = Q.defer();
        try {
            if (solutionPath) {
                fs.exists(solutionPath, (exists: boolean) => {
                    if (exists) {
                        var vsVersion: number = 0;
                        const rr = fs.createReadStream(solutionPath);
                        const reader = rl.createInterface({ input: rr });
                        reader.on('line', (line: string) => {
                            if (utils.strStartsWith(line, 'VisualStudioVersion')) {
                                var verDetails: string = utils.trimExcess(line.split('=')[1]);
                                vsVersion = parseInt(verDetails.substr(0, 2), 10);
                            }
                        });

                        reader.on('close', () => {
                            deferred.resolve(vsVersion);
                        });
                    } else {
                        console.warn('The solution file doesn\'t exist');
                        deferred.reject('The solution file doesn\'t exist');
                    }
                });
            }
        } catch (ex) {
            deferred.reject(ex);
        }

        return deferred.promise;
    }

    private restorePackages = (solutionPath: string): Q.Promise<string> => {
        var deferred = Q.defer<string>();

        try {
            var options = ['restore', solutionPath];
            var out = '';
            const cmd = spawn.spawn('C:\\Web\\nuget.exe', options);

            cmd.stdout.on('data', (data: string) => {
                out += data;
            });

            cmd.stderr.on('data', (data: string) => {
                out += data;
            });

            cmd.on('close', (code: number) => {
                console.warn('child process exited with code ' + code);
                deferred.resolve('child process exited with code ' + code);
            });
        } catch (ex) {
            deferred.reject(ex);
        }

        return deferred.promise;
    }

    private build = (vsVersion: number, solutionPath: string, userId: string): Q.Promise<any> => {
        var deferred = Q.defer();
        var msbuild = '';

        try {

            switch (vsVersion) {
                case 12: {
                    msbuild = 'C:\\Program Files (x86)\\MSBuild\\12.0\\Bin\\MSBuild.exe';
                    break;
                }
                case 14: {
                    msbuild = 'C:\\Program Files (x86)\\MSBuild\\14.0\\Bin\\MSBuild.exe';
                    break;
                }
                default: {
                    deferred.reject('Unknown Visual Studio Version');
                    return;
                }
            }

            var options = [solutionPath];
            var out = '';
            var logFile = Date.now() + '.log';
            var solnFolder = path.dirname(solutionPath);
            console.warn('The folder for solution file : ' + solutionPath + 'is :' + solnFolder);
            const cmd = spawn.spawn(msbuild, options);

            cmd.stdout.on('data', (data: string) => {
                out += data;
            });

            cmd.stderr.on('data', (data: string) => {
                out += data;
            });

            cmd.on('close', (code: number) => {
                console.warn('child process exited with code ' + code);
                // TODO : Move this outside to handle exceptions from child process
                utils.writeFile(path.join(solnFolder, logFile), utils.replace(out));
                deferred.resolve({
                    reason: 'child process exited with code ' + code,
                    log: utils.replace(path.join(solnFolder, logFile)).substr(userId.length)
                });
            //    deferred.resolve({ 'result': utils.splitByCRLF(out) });
            });
        } catch (ex) {
            deferred.reject(ex);
        }

        return deferred.promise;
    }
}
