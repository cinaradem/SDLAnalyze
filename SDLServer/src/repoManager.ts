'use strict';

import express = require('express');
import Q = require('q');
import fs = require('fs');
import path = require('path');
import spawn = require('child_process');
import cfg = require('./config');
import jwt = require('./jwtManage');
import jsonwt = require('jsonwebtoken');
import base = require('./base');
import da = require('./dal');
import fl = require('./fileHandler');
import ut = require('./utils');
var utils = ut.Utils;

export class RepoManager extends base.Base {
    gitCloneRootFolder: string = 'C:\\GitRepos\\';

    constructor(da: da.DataAccess) {
        super();
        this.dataAccess = da;
    }

    errorHandler = (): express.RequestHandler => {
        return (req: express.Request, res: express.Response, next: express.NextFunction) => {
            return res.status(400).json({
                Message: 'Error while cloning the Git Repository',
                ExceptionMessage: {}
            });
        };
    }

    cloneRepository = (): express.RequestHandler => {
        var self = this;
        return (req: express.Request, res: express.Response) => {
            try {
                jwt.JwtManager.authenticate(req.headers).then((decoded: any) => {
                    var query = req.query;
                    //var headers: { [key: string]: string; } = req.headers;
                    //console.warn('req:', headers);
                    var id = decoded._id;
                    if (!id || !id.length) {
                        return res.status(401).json('No valid id exist for this user');
                    }

                    if (!query.gitRepoUrl || query.gitRepoUrl === 'undefined') {
                        return res.status(400).json('A Git Repository uri is required.');
                    }

                    var gitRepoUrl = encodeURI(query.gitRepoUrl).replace(/^[\"\s\/]+|[\"\s\/]+$/gm, '');
                    console.warn('Git Repository Path :' + gitRepoUrl);
                    if (gitRepoUrl.substr(0, 8) !== 'https://') {
                        return res.status(400).json('Only https urls for Git are supported');
                    }

                    var gitRepoUrlModified = gitRepoUrl.replace('https://',
                        'https://' + cfg.Config.data.user + ':' +
                        cfg.Config.data.token + '@');
                    var gitCloneFolder = gitRepoUrl.substring(gitRepoUrl.lastIndexOf('/') + 1);
                    gitCloneFolder = path.join(id, gitCloneFolder);

                    var messageId = jsonwt.sign({ method: 'cloneRepository' }, Date.now().toLocaleString());
                    res.status(200).json(messageId);

                    self.cloneGitRepo(id, gitCloneFolder, gitRepoUrlModified).then((cloneResult: any) => {
                        //{ reason: 'child process exited with code ' + code, log: path.join(gitCloneFolder, logFile) }
                        var fd: fl.FileData = {
                            userId: id,
                            name: cloneResult.log,
                            link: '/sdlserver/api/Files?userId=' +
                            id + '&fileName=' + cloneResult.log +
                            '&token=' + jwt.JwtManager.getToken()
                        };
                        self.parseCloneFolder(id, gitCloneFolder, cloneResult.success).then((parseResult: Array<string>) => {
                            self.sendSocketMessage(messageId, { cloneUri: query.gitRepoUrl, clonedSolutions: parseResult, logFile: fd });
                        }).catch((ex: any) => {
                            self.sendSocketMessage(messageId, {
                                cloneUri: query.gitRepoUrl,
                                Message: 'Error while getting the project list in the cloned folder',
                                ExceptionMessage: ex
                            });
                        });
                    }).catch((ex: any) => {
                        self.sendSocketMessage(messageId, {
                            cloneUri: query.gitRepoUrl,
                            Message: 'Error while cloning the Git Repository : ' + gitRepoUrl,
                            ExceptionMessage: ex
                        });
                    });

                    //self.cloneGitRepo().then(() => {
                    //    self.parseCloneFolder().then(() => {
                    //        res.status(200).json(self.solutionFiles);
                    //    }).catch((ex: any) => {
                    //        return res.status(400).json({
                    //            Message: 'Error while getting the project list in the cloned folder',
                    //            ExceptionMessage: ex
                    //        });
                    //    });
                    //}).catch((ex: any) => {
                    //    return res.status(400).json({
                    //        Message: 'Error while cloning the Git Repository : ' + self.gitRepoUrl,
                    //        ExceptionMessage: ex
                    //    });
                    //});
                }).catch((ex: any) => {
                    console.warn('Error while authentication: ' + JSON.stringify(ex));
                    return res.status(401).json('Failed to authenticate token.');
                });

            } catch (ex) {
                console.warn('Unexpected Error while Cloning' + ex);
                self.sendExceptionMessage(res, 'Unexpected Error while Cloning', ex);
            }

        };
    }

    cloneGitRepo = (userId: string, gitCloneFolder: string, gitRepoUrlModified: string): Q.Promise<any> => {
        var deferred = Q.defer();
        var self = this;

        try {
            var cloneFolder = path.join(self.gitCloneRootFolder, gitCloneFolder);

            self.deleteCloneFolder(userId, cloneFolder, () => {
                console.warn('********************** Start Cloning **************************');
                var options = ['clone', '--verbose', '--progress', gitRepoUrlModified, cloneFolder];
                var out = '';

                var logFile = Date.now() + '.log';
                const cmd = spawn.spawn('git.exe', options);

                cmd.stdout.on('data', (data: string) => {
                    //var temp = '' + data;
                    //console.warn(temp);
                    out += data;
                });

                cmd.stderr.on('data', (data: string) => {
                    var temp = '' + data;
                    console.warn(temp);
                    out += data;
                    if (temp.indexOf('error:') !== -1) {
                        console.warn('Some Error');
                        utils.writeFile(path.join(cloneFolder, logFile), utils.replace(out));
                        deferred.reject(temp);
                    }
                });

                cmd.on('close', (code: number) => {
                    var cloneSuccess = false;
                    if (code === 0 && (out.indexOf('Receiving objects: 100%') !== -1 || out.indexOf('Compressing objects: 100%') !== -1)) {
                        cloneSuccess = true;
                    }
                    console.warn('child process exited with code ' + code);
                    utils.writeFile(path.join(cloneFolder, logFile), utils.replace(out));
                    deferred.resolve({
                        reason: 'child process exited with code ' + code,
                        log: path.join(gitCloneFolder.replace(userId, ''), logFile), success: cloneSuccess
                    });
                });
            });
        } catch (ex) {
            deferred.reject(ex);
        }

        return deferred.promise;
    }

    private parseCloneFolder = (userId: string, gitCloneFolder: string, cloneSuccess: boolean): Q.Promise<any> => {
        var deferred = Q.defer();
        var self = this;

        try {
            if (cloneSuccess) {
                var solutionFiles: Array<string> = [];
                self.walkFolderRecursiveAndDoAction(userId, path.join(self.gitCloneRootFolder, gitCloneFolder), false, solutionFiles, true);
                deferred.resolve(solutionFiles);
            } else {
                deferred.reject('Something went wrong while cloning');
            }
        } catch (e) {
            deferred.reject(e);
        }

        return deferred.promise;
    }

    private walkFolderRecursiveAndDoAction = (userId: string, folder: string, del: boolean,
        solutionFiles: Array<string> = null, collectSoln: boolean = false) => {
        var self = this;
        try {
            if (fs.existsSync(folder)) {
                fs.readdirSync(folder).forEach((file: string, index: number) => {
                    var curPath: string = path.join(folder, file);
                    if (fs.lstatSync(curPath).isDirectory()) {
                        self.walkFolderRecursiveAndDoAction(userId, curPath, del, solutionFiles, collectSoln);
                    } else {
                        if (del) { fs.unlinkSync(curPath); }
                        if (collectSoln && path.extname(curPath) === '.sln') {
                            var slnPath = curPath.substr(self.gitCloneRootFolder.length + path.delimiter.length + userId.length);
                            solutionFiles.push(slnPath);
                        }
                    }
                });

                if (del) { fs.rmdirSync(folder); }
            }
        } catch (e) {
            console.warn('Inside walkFolderRecursiveAndDoAction Catch : ' + e);
            throw e;
        }
    }

    private deleteCloneFolder = (userId: string, folder: string, callback: Function): void => {
        var self = this;
        try {
            if (fs.existsSync(folder)) {
                self.walkFolderRecursiveAndDoAction(userId, folder, true);
                callback();
            } else {
                callback();
            }
        } catch (e) {
            console.warn('Inside deleteCloneFolder Catch : ' + e);
            throw e;
        }
    }
}
